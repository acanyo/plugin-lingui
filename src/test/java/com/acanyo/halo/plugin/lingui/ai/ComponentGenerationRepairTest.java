package com.acanyo.halo.plugin.lingui.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.acanyo.halo.plugin.lingui.ai.progress.GenerationEvent;
import com.acanyo.halo.plugin.lingui.ai.progress.GenerationProgress;
import com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import com.acanyo.halo.plugin.lingui.ai.tools.SkillResources;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import run.halo.aifoundation.chat.FinishReason;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerateTextResult;
import run.halo.aifoundation.chat.GenerationStep;
import run.halo.aifoundation.chat.StepContext;
import run.halo.aifoundation.message.ModelMessage;
import run.halo.aifoundation.tool.ToolExecutionContext;
import run.halo.app.plugin.ReactiveSettingFetcher;

class ComponentGenerationRepairTest {
    private final DesignValidator validator = new DesignValidator();
    private final CreationTools tools = new CreationTools(new ComponentCatalog(), new SkillResources(), validator);
    private final Map<String, Object> design = Map.of("schemaVersion", "lingui.document/2", "title", "问候",
        "parameters", List.of(), "state", Map.of(),
        "nodes", List.of(Map.of("id", "root", "component", "Text", "text", "你好")));

    ComponentGenerationRepairTest() throws Exception {}

    private GenerateTextResult output(String text) {
        return GenerateTextResult.builder().text(text).finishReason(FinishReason.STOP).build();
    }

    private GenerateTextRequest request() {
        return GenerateTextRequest.builder().system("创作规则").prompt("生成问候组件")
            .maxOutputTokens(4096).maxRetries(0).build();
    }

    @Test
    void repairsPrematureNonJsonTextUsingTheOriginalRequirementsToolsAndResponseHistory() {
        var session = tools.session(null);
        var progressEvents = new ArrayList<GenerationEvent>();
        var progress = new GenerationProgress(progressEvents::add);
        var history = List.of(ModelMessage.assistant("正在生成，请稍候"));
        var original = request();
        original.setTools(session.tools());
        original.setLifecycle(progress);
        var requests = new ArrayList<GenerateTextRequest>();
        var result = ComponentGeneration.generate(original, session, progress, next -> {
            requests.add(next);
            if (requests.size() == 1) return Mono.just(GenerateTextResult.builder().text("正在生成，请稍候")
                .responseMessages(history).finishReason(FinishReason.STOP).build());
            var submit = next.getTools().stream().filter(tool -> tool.getName().equals("validate_design"))
                .findFirst().orElseThrow();
            return submit.getExecutor().execute(ToolExecutionContext.builder()
                .input(Map.of("design", design, "finalize", true)).build())
                .thenReturn(GenerateTextResult.builder().finishReason(FinishReason.TOOL_CALLS).build());
        }).block();

        validator.requireValid(validator.parse(result));
        assertThat(result).contains("你好").doesNotContain("nodes");
        assertThat(requests).hasSize(2);
        var repair = requests.get(1);
        assertThat(repair.getPrompt()).isNull();
        assertThat(repair.getMessages().getFirst().getContent().getFirst().getText()).isEqualTo("生成问候组件");
        assertThat(repair.getMessages().get(1)).isSameAs(history.getFirst());
        assertThat(repair.getMessages().getLast().getContent().getFirst().getText())
            .contains("validate_design", "finalize=true", "JSON 语法错误");
        assertThat(repair.getTools()).isSameAs(original.getTools());
        assertThat(repair.getLifecycle()).isSameAs(progress);
        assertThat(repair.getMaxOutputTokens()).isEqualTo(4096);
        assertThat(repair.getStopWhen().shouldContinue(StepContext.builder().stepIndex(5).build())).isFalse();
        assertThat(progressEvents).anyMatch(event -> "repair-output".equals(event.id()) && "done".equals(event.state()));
    }

    @Test
    void retriesInvalidOutputOnlyOnceAndNeverLeaksItsContents() {
        var calls = new AtomicInteger();
        assertThatThrownBy(() -> ComponentGeneration.generate(request(), tools.session(null), new GenerationProgress(), next -> {
            calls.incrementAndGet();
            return Mono.just(output("<private-provider-content>"));
        }).block()).isInstanceOfSatisfying(ResponseStatusException.class, error -> {
            assertThat(error.getBody().getProperties()).containsEntry("category", "invalid-design");
            assertThat(error.getReason()).contains("JSON 语法错误", "第 1 行").doesNotContain("private-provider-content", "重复字段");
        });
        assertThat(calls).hasValue(2);
    }

    @Test
    void doesNotResetTheStepLimitOrRetryTruncationAndTransportErrors() {
        for (var result : List.of(
            GenerateTextResult.builder().text("{").steps(java.util.Collections.nCopies(7, GenerationStep.builder().build())).build(),
            GenerateTextResult.builder().text("{").finishReason(FinishReason.LENGTH).build())) {
            var calls = new AtomicInteger();
            assertThatThrownBy(() -> ComponentGeneration.generate(request(), tools.session(null), new GenerationProgress(), next -> {
                calls.incrementAndGet();
                return Mono.just(result);
            }).block()).isInstanceOf(ResponseStatusException.class);
            assertThat(calls).hasValue(1);
        }
        var calls = new AtomicInteger();
        assertThatThrownBy(() -> ComponentGeneration.generate(request(), tools.session(null), new GenerationProgress(), next -> {
            calls.incrementAndGet();
            return Mono.error(new IllegalStateException("provider failed"));
        }).block()).hasMessage("provider failed");
        assertThat(calls).hasValue(1);
    }

    @Test
    void reportsTheLastValidationIssueWhenToolsExhaustTheirRoundsInsteadOfParsingToolTextAsJson() {
        var session = tools.session(null);
        var invalid = new java.util.HashMap<>(design);
        invalid.put("publicEmbed", true);
        var submit = session.tools().stream().filter(tool -> tool.getName().equals("validate_design"))
            .findFirst().orElseThrow();
        submit.getExecutor().execute(ToolExecutionContext.builder()
            .input(Map.of("design", invalid, "finalize", true)).build()).block();
        assertThatThrownBy(() -> ComponentGeneration.generate(request(), session, new GenerationProgress(),
            next -> Mono.just(GenerateTextResult.builder().text("已调用工具")
                .finishReason(FinishReason.TOOL_CALLS).build())).block())
            .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                assertThat(error.getBody().getProperties()).containsEntry("category", "tool-limit");
                assertThat(error.getReason()).contains("publicEmbed", "最近校验问题").doesNotContain("JSON 语法错误");
            });
    }

    @Test
    void aRepairCannotDropRequiredApiFunctionalityToPassValidation() {
        var session = tools.session(null, "通过 https://api.example.com/weather 展示天气");
        var incomplete = validator.normalizeToolDesign(new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(design)).toString();
        assertThatThrownBy(() -> ComponentGeneration.generate(request(), session, new GenerationProgress(),
            next -> Mono.just(output(incomplete))).block())
            .isInstanceOfSatisfying(ResponseStatusException.class,
                error -> assertThat(error.getReason()).contains("实际请求动作"));
        assertThat(session.complete()).isFalse();
    }

    @Test
    void repairSharesTheOriginalDeadlineAndSignalsCancellationToCachedFoundationWork() throws Exception {
        var settings = mock(ReactiveSettingFetcher.class);
        var foundation = mock(AiFoundationClient.class);
        when(settings.fetch("ai", AiSettings.class)).thenReturn(Mono.just(new AiSettings(true, null, 4096)));
        var requests = new ArrayList<GenerateTextRequest>();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation -> {
            requests.add(invocation.getArgument(1));
            return requests.size() == 1
                ? Mono.delay(Duration.ofMinutes(4)).thenReturn(output("invalid output"))
                : Mono.never();
        });
        var service = new AiService(settings, foundation, new ComponentPrompt(), new ThemePrompt(), tools);
        StepVerifier.withVirtualTime(() -> service.generate(new AiEndpoint.GenerateRequest("生成问候", null)))
            .expectSubscription().thenAwait(Duration.ofMinutes(6))
            .expectErrorSatisfies(error -> assertThat(error).isInstanceOfSatisfying(ResponseStatusException.class,
                response -> assertThat(response.getStatusCode().value()).isEqualTo(504)))
            .verify();
        assertThat(requests).hasSize(2);
        assertThat(requests.get(1).getCancellationToken()).isSameAs(requests.getFirst().getCancellationToken());
        assertThat(requests.getFirst().getCancellationToken().isCancellationRequested()).isTrue();
    }
}
