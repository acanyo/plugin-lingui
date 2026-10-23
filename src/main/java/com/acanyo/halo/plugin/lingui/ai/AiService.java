package com.acanyo.halo.plugin.lingui.ai;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;
import com.acanyo.halo.plugin.lingui.ai.progress.GenerationEvent;
import com.acanyo.halo.plugin.lingui.ai.progress.GenerationProgress;
import com.acanyo.halo.plugin.lingui.ai.progress.GenerationStream;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerationTimeouts;
import run.halo.aifoundation.chat.FinishReason;
import run.halo.app.plugin.ReactiveSettingFetcher;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationSession;
import run.halo.aifoundation.chat.StopCondition;
import run.halo.aifoundation.control.CancellationSource;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationStepPolicy;

@Service
public class AiService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(AiService.class);
    private static final Duration COMPONENT_TIMEOUT = Duration.ofMinutes(6);
    private static final Duration THEME_TIMEOUT = Duration.ofMinutes(3);
    private final ReactiveSettingFetcher settings;
    private final AiFoundationClient foundation;
    private final ComponentPrompt prompt;
    private final ThemePrompt themePrompt;
    private final CreationTools tools;
    private final AtomicInteger inFlight = new AtomicInteger();

    public AiService(ReactiveSettingFetcher settings, AiFoundationClient foundation,
        ComponentPrompt prompt, ThemePrompt themePrompt, CreationTools tools) {
        this.settings = settings;
        this.foundation = foundation;
        this.prompt = prompt;
        this.themePrompt = themePrompt;
        this.tools = tools;
    }

    public Mono<String> generate(AiEndpoint.GenerateRequest request) {
        return Mono.defer(() -> generate(request, new GenerationProgress()));
    }

    public Flux<GenerationEvent> generateEvents(AiEndpoint.GenerateRequest request) {
        return GenerationStream.create(progress -> generate(request, progress));
    }

    public Mono<AiEndpoint.GenerationSettings> generationSettings() {
        return settings.fetch("ai", AiSettings.class)
            .map(config -> new AiEndpoint.GenerationSettings(normalizeModelName(config.modelName())))
            .defaultIfEmpty(new AiEndpoint.GenerationSettings(""));
    }

    private Mono<String> generate(AiEndpoint.GenerateRequest request, GenerationProgress progress) {
        if (request.instruction() == null || request.instruction().isBlank()
            || request.instruction().length() > 4000
            || (request.document() != null && request.document().length() > 262144)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "请输入 1–4000 字符的需求，已有组件不能超过 256 KiB"));
        }
        if (normalizeModelName(request.modelName()).length() > 160) {
            return Mono.error(invalidModelName());
        }
        return Mono.defer(() -> generate(prompt.system(request), prompt.user(request),
            tools.session(request.document(), request.instruction()), progress, request.modelName()));
    }

    public Mono<String> generateTheme(AiEndpoint.GenerateThemeRequest request) {
        if (request.instruction() == null || request.instruction().isBlank()
            || request.instruction().length() > 4000
            || (request.theme() != null && request.theme().length() > 8192)) {
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "请输入 1–4000 字符的主题需求，当前主题不能超过 8 KiB"));
        }
        if (normalizeModelName(request.modelName()).length() > 160) {
            return Mono.error(invalidModelName());
        }
        return generate(themePrompt.system(), themePrompt.user(request), null, new GenerationProgress(), request.modelName());
    }

    private Mono<String> generate(String system, String user, CreationSession session, GenerationProgress progress,
        String requestedModelName) {
        var timeout = session == null ? THEME_TIMEOUT : COMPONENT_TIMEOUT;
        return Mono.defer(() -> {
            if (inFlight.incrementAndGet() > 3) {
                inFlight.decrementAndGet();
                return Mono.error(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                    "当前生成任务较多，请稍后重试"));
            }
            var cancellation = new CancellationSource();
            return settings.fetch("ai", AiSettings.class)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "请先在灵构 UI 插件设置中启用 AI 生成")))
                .flatMap(config -> {
                    if (!config.enabled()) {
                        return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "请先在灵构 UI 插件设置中启用 AI 生成，再在工作台选择 AI 基座语言模型"));
                    }
                    var modelName = normalizeModelName(requestedModelName == null
                        ? config.modelName() : requestedModelName);
                    if (modelName.length() > 160) {
                        return Mono.error(invalidModelName());
                    }
                    if (config.outputBudget() < 1024 || config.outputBudget() > 32768) {
                        return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "请在灵构 UI 的 AI 设置中将输出 Token 预算设为 1024–32768"));
                    }
                    var builder = GenerateTextRequest.builder()
                        .system(system)
                        .prompt(user)
                        .maxOutputTokens(config.outputBudget())
                        .maxRetries(0)
                        .lifecycle(progress)
                        .cancellationToken(cancellation.token())
                        .timeouts(GenerationTimeouts.total(timeout));
                    if (session != null) {
                        builder.tools(session.tools()).stopWhen(step -> !session.complete()
                            && StopCondition.stepCountIs(CreationStepPolicy.STEP_LIMIT).shouldContinue(step))
                            .prepareStep(step -> CreationStepPolicy.prepare(step, system));
                    }
                    var generation = builder.build();
                    if (session != null) return ComponentGeneration.generate(generation, session, progress,
                        next -> foundation.generate(modelName.isEmpty() ? null : modelName, next));
                    long started = System.nanoTime();
                    return foundation.generate(modelName.isEmpty() ? null : modelName, generation)
                        .map(result -> {
                            LOG.info("Lingui AI completed: elapsedMs={}, systemBytes={}, steps={}, toolCalls={}",
                                (System.nanoTime() - started) / 1_000_000,
                                system.getBytes(java.nio.charset.StandardCharsets.UTF_8).length,
                                result.getSteps() == null ? 0 : result.getSteps().size(),
                                result.getToolCalls() == null ? 0 : result.getToolCalls().size());
                            if (result.getFinishReason() == FinishReason.LENGTH) {
                                throw AiGenerationErrors.outputLimit();
                            }
                            var text = result.getText();
                            if ((text == null || text.isBlank()) && result.getFinishReason() == FinishReason.TOOL_CALLS) {
                                throw AiGenerationErrors.toolLimit();
                            }
                            if (text == null || text.isBlank() || text.length() > 262144) {
                                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                                    "AI 返回内容为空或超过 256 KiB，请缩小需求后重试");
                            }
                            return text;
                        });
                })
                .timeout(timeout, Mono.defer(() -> Mono.error(AiGenerationErrors.deadline(timeout))))
                .onErrorMap(error -> !(error instanceof ResponseStatusException),
                    error -> AiGenerationErrors.translate(progress.failureOr(error)))
                .doFinally(signal -> {
                    cancellation.cancel();
                    inFlight.decrementAndGet();
                });
        });
    }

    private static String normalizeModelName(String modelName) {
        return modelName == null ? "" : modelName.trim();
    }

    private static ResponseStatusException invalidModelName() {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST,
            "模型资源名称无效，请在工作台重新选择 AI 基座语言模型");
    }
}
