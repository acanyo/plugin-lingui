package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.progress.GenerationProgress;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationSession;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationStepPolicy;
import java.util.ArrayList;
import java.util.function.Function;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.aifoundation.chat.FinishReason;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerateTextResult;
import run.halo.aifoundation.chat.StopCondition;
import run.halo.aifoundation.message.ModelMessage;

/** Validates component output and gives a premature text response one bounded repair attempt. */
final class ComponentGeneration {
    private ComponentGeneration() {}

    static Mono<String> generate(GenerateTextRequest request, CreationSession session,
        GenerationProgress progress, Function<GenerateTextRequest, Mono<GenerateTextResult>> generate) {
        return attempt(request, session, progress, generate, CreationStepPolicy.STEP_LIMIT, false);
    }

    private static Mono<String> attempt(GenerateTextRequest request, CreationSession session,
        GenerationProgress progress, Function<GenerateTextRequest, Mono<GenerateTextResult>> generate,
        int remainingSteps, boolean repairing) {
        return Mono.defer(() -> generate.apply(request)).flatMap(result -> {
            int steps = result.getSteps() == null || result.getSteps().isEmpty() ? 1 : result.getSteps().size();
            LoggerFactory.getLogger(ComponentGeneration.class).info(
                "Lingui AI component response: elapsedMs={}, steps={}, toolCalls={}, repairing={}",
                progress.elapsedMs(), steps, result.getToolCalls() == null ? 0 : result.getToolCalls().size(), repairing);
            if (session.complete()) return Mono.just(session.output());
            if (result.getFinishReason() == FinishReason.LENGTH) return Mono.error(AiGenerationErrors.outputLimit());
            var text = result.getText();
            if (result.getFinishReason() == FinishReason.TOOL_CALLS)
                return Mono.error(AiGenerationErrors.toolLimit(session.lastValidationIssue()));
            if (text == null || text.isBlank() || text.length() > 262144)
                return Mono.error(new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "AI 返回内容为空或超过 256 KiB，请缩小需求后重试"));
            try {
                return Mono.just(session.validateOutput().apply(text));
            } catch (IllegalArgumentException invalid) {
                int availableSteps = remainingSteps - steps;
                if (repairing || availableSteps <= 0) return Mono.error(AiGenerationErrors.invalidDesign(invalid.getMessage()));
                progress.activity("repair-output", "返回内容未通过校验，正在自动修正", "running");
                progress.nextAttempt(steps);
                return attempt(repairRequest(request, result, session, invalid.getMessage(), availableSteps),
                    session, progress, generate, availableSteps, true)
                    .doOnNext(ignored -> progress.activity("repair-output", "返回内容已修正并通过校验", "done"))
                    .doOnError(ignored -> progress.activity("repair-output", "自动修正后仍未完成有效设计", "warning"));
            }
        });
    }

    private static GenerateTextRequest repairRequest(GenerateTextRequest original, GenerateTextResult result,
        CreationSession session, String issue, int remainingSteps) {
        var messages = new ArrayList<ModelMessage>();
        if (original.getMessages() != null) messages.addAll(original.getMessages());
        else messages.add(ModelMessage.user(original.getPrompt()));
        // SDK response messages retain tool results and provider reasoning needed for continuation.
        if (result.getResponseMessages() != null && !result.getResponseMessages().isEmpty())
            messages.addAll(result.getResponseMessages());
        else messages.add(ModelMessage.assistant(result.getText()));
        messages.add(ModelMessage.user("上一次返回内容未通过作品校验：" + issue
            + "。请保留原始需求、已有作品与接口，修正后通过真正的 validate_design 工具调用提交完整设计，"
            + "优先使用 document.nodes 组件对象数组，并设置 finalize=true。不要把工具调用协议、说明文字或 Markdown 当成作品输出。"
            + "如果直接返回文本，必须仅返回完整有效的设计 JSON；JSON 字段不能重复，source 内的引号和换行必须正确转义。"));
        return GenerateTextRequest.builder()
            .system(original.getSystem()).messages(messages)
            .maxOutputTokens(original.getMaxOutputTokens()).maxRetries(original.getMaxRetries())
            .tools(original.getTools()).toolChoice(original.getToolChoice())
            .lifecycle(original.getLifecycle()).cancellationToken(original.getCancellationToken())
            .timeouts(original.getTimeouts())
            .stopWhen(step -> !session.complete() && StopCondition.stepCountIs(remainingSteps).shouldContinue(step))
            .prepareStep(step -> CreationStepPolicy.prepare(step, original.getSystem(), CreationStepPolicy.STEP_LIMIT - remainingSteps))
            .build();
    }
}
