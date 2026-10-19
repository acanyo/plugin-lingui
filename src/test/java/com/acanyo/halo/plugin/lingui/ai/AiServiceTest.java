package com.acanyo.halo.plugin.lingui.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerateTextResult;
import run.halo.aifoundation.chat.FinishReason;
import run.halo.aifoundation.exception.DefaultModelNotConfiguredException;
import run.halo.aifoundation.exception.ProviderApiException;
import run.halo.aifoundation.lifecycle.GenerationErrorEvent;
import run.halo.app.plugin.ReactiveSettingFetcher;

class AiServiceTest {
    private static final String VALID_DESIGN = new com.fasterxml.jackson.databind.ObjectMapper().valueToTree(java.util.Map.of(
        "schemaVersion", "lingui.document/2", "title", "问候", "parameters", java.util.List.of(),
        "source", "root = Text({\"id\":\"root\",\"text\":\"你好\"}, [])", "state", java.util.Map.of())).toString();
    private final ReactiveSettingFetcher settings = mock(ReactiveSettingFetcher.class);
    private final AiFoundationClient foundation = mock(AiFoundationClient.class);
    private AiService service;
    private final AiEndpoint.GenerateRequest request = new AiEndpoint.GenerateRequest("调整为横向", """
        {"schemaVersion":"lingui.document/2","title":"已有组件","parameters":[],"source":"root = Column({\\\"id\\\":\\\"root\\\",\\\"children\\\":[]}, [])","state":{}}
        """);

    @BeforeEach
    void setup() throws IOException {
        service = new AiService(settings, foundation, new ComponentPrompt(), new ThemePrompt(), new com.acanyo.halo.plugin.lingui.ai.tools.CreationTools(
            new com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog(),
            new com.acanyo.halo.plugin.lingui.ai.tools.SkillResources(),
            new com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator()));
    }

    private void enable() {
        when(settings.fetch("ai", AiSettings.class)).thenReturn(Mono.just(new AiSettings(true, null, null)));
    }

    private Mono<String> generateWithModel(boolean theme, String modelName) {
        return theme
            ? service.generateTheme(new AiEndpoint.GenerateThemeRequest("深色", null, modelName))
            : service.generate(new AiEndpoint.GenerateRequest(request.instruction(), request.document(), modelName));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void workbenchSelectionOverridesTheLegacyModelForComponentsAndThemes(boolean theme) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, "legacy-model", null)));
        when(foundation.generate(eq("workbench-model"), any()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));

        assertEquals(VALID_DESIGN, generateWithModel(theme, "  workbench-model  ").block());

        verify(foundation).generate(eq("workbench-model"), any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void omittedModelsPreserveTheTrimmedLegacySelection(boolean theme) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, "  legacy-model  ", null)));
        when(foundation.generate(eq("legacy-model"), any()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));

        assertEquals(VALID_DESIGN, generateWithModel(theme, null).block());

        verify(foundation).generate(eq("legacy-model"), any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void explicitEmptyAndWhitespaceSelectionsUseFoundationDefaultInsteadOfLegacyModel(boolean theme) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, "legacy-model", null)));
        when(foundation.generate(isNull(), any()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));

        assertEquals(VALID_DESIGN, generateWithModel(theme, "").block());
        assertEquals(VALID_DESIGN, generateWithModel(theme, "  ").block());

        verify(foundation, org.mockito.Mockito.times(2)).generate(isNull(), any());
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsInvalidWorkbenchModelsBeforeReadingConfigurationOrCallingFoundation(boolean theme) {
        var error = assertThrows(ResponseStatusException.class,
            () -> generateWithModel(theme, "  " + "x".repeat(161) + "  ").block());

        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("工作台"));
        verifyNoInteractions(settings, foundation);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void rejectsInvalidLegacyModelsBeforeCallingFoundation(boolean theme) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, "x".repeat(161), null)));

        var error = assertThrows(ResponseStatusException.class, () -> generateWithModel(theme, null).block());

        assertEquals(400, error.getStatusCode().value());
        verifyNoInteractions(foundation);
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void acceptsAMaximumLengthWorkbenchModelEvenWhenLegacySelectionIsInvalid(boolean theme) {
        var modelName = "x".repeat(160);
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, "x".repeat(161), null)));
        when(foundation.generate(eq(modelName), any()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));

        assertEquals(VALID_DESIGN, generateWithModel(theme, "  " + modelName + "  ").block());

        verify(foundation).generate(eq(modelName), any());
    }

    @Test
    void generationSettingsExposeOnlyTheNormalizedLegacyModel() {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(false, "  legacy-model  ", 4096)));

        assertEquals(new AiEndpoint.GenerationSettings("legacy-model"), service.generationSettings().block());
        verifyNoInteractions(foundation);
    }

    @Test
    void generationSettingsDefaultWhenThePluginHasNoAiConfiguration() {
        when(settings.fetch("ai", AiSettings.class)).thenReturn(Mono.empty());

        assertEquals(new AiEndpoint.GenerationSettings(""), service.generationSettings().block());
        verifyNoInteractions(foundation);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    void generationSettingsNormalizeMissingLegacyModelsToFoundationDefault(String modelName) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, modelName, null)));

        assertEquals(new AiEndpoint.GenerationSettings(""), service.generationSettings().block());
        verifyNoInteractions(foundation);
    }

    @Test
    void sendsShortSkillAndRequestScopedTools() {
        enable();
        var capture = ArgumentCaptor.forClass(GenerateTextRequest.class);
        when(foundation.generate(isNull(), capture.capture()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));
        assertTrue(service.generate(request).block().contains("lingui.document/2"));
        var generation = capture.getValue();
        assertTrue(generation.getSystem().contains("urn:lingui:openui:1"));
        assertTrue(generation.getSystem().contains("用户指定风格优先"));
        assertTrue(generation.getSystem().length() < 6000);
        assertTrue(generation.getPrompt().contains("get_current_work"));
        assertFalse(generation.getPrompt().contains(request.document()));
        assertEquals(5, generation.getTools().size());
        assertTrue(generation.getTools().stream().anyMatch(tool -> tool.getName().equals("validate_design")));
        var finalStep = generation.getPrepareStep().prepare(run.halo.aifoundation.chat.StepContext.builder().stepIndex(6).build());
        assertNull(finalStep.getToolChoice());
        assertNull(finalStep.getActiveTools());
        assertTrue(finalStep.getMessages().getFirst().getContent().getFirst().getText().contains("必须调用 validate_design"));
        assertEquals(16384, generation.getMaxOutputTokens());
        assertEquals(0, generation.getMaxRetries());
        assertEquals(Duration.ofMinutes(6), generation.getTimeouts().getTotalTimeout());
        assertNull(generation.getPrepareStep().prepare(run.halo.aifoundation.chat.StepContext.builder().stepIndex(2).build()).getActiveTools());
        assertEquals(5, generation.getTools().size());
        assertNull(generation.getHeaders());
    }


    @ParameterizedTest
    @ValueSource(strings = {"<｜｜DSML｜｜ calls>private-model-content</｜｜DSML｜｜ calls>",
        "{\"schemaVersion\":\"lingui.document/2\"}", "{", "null"})
    void rejectsUnvalidatedOutputWithoutReturningProviderProtocol(String content) {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder().text(content).build()));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(502, error.getStatusCode().value());
        assertEquals("invalid-design", error.getBody().getProperties().get("category"));
        assertTrue(error.getReason().contains("未通过作品校验"));
        assertFalse(error.getReason().contains("DSML"));
        assertFalse(error.getReason().contains("private-model-content"));
    }

    @Test
    void validatesAndNormalizesPlainOrFencedDesigns() {
        enable();
        for (var content : java.util.List.of(VALID_DESIGN, "```json\n" + VALID_DESIGN + "\n```")) {
            when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder().text(content).build()));
            assertEquals(VALID_DESIGN, service.generate(request).block());
        }
    }

    @Test
    void rejectsDisabledGenerationBeforeAccessingFoundation() {
        when(settings.fetch("ai", AiSettings.class)).thenReturn(Mono.just(new AiSettings(false, null, null)));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(400, error.getStatusCode().value());
        verifyNoInteractions(foundation);
    }

    @Test
    void returnsValidatedToolArtifactWithoutAskingTheModelToRepeatIt() {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation -> {
            GenerateTextRequest generation = invocation.getArgument(1);
            var finalDesign = java.util.Map.of("schemaVersion", "lingui.document/2", "title", "问候",
                "parameters", java.util.List.of(), "source", "root = Text({\"id\":\"root\",\"text\":\"你好\"}, [])",
                "state", java.util.Map.of());
            var validate = generation.getTools().stream().filter(tool -> tool.getName().equals("validate_design"))
                .findFirst().orElseThrow();
            return validate.getExecutor().execute(run.halo.aifoundation.tool.ToolExecutionContext.builder()
                .input(java.util.Map.of("design", finalDesign, "finalize", true)).build()).map(ignored -> {
                    assertFalse(generation.getStopWhen().shouldContinue(run.halo.aifoundation.chat.StepContext.builder()
                        .stepIndex(2).build()));
                    return GenerateTextResult.builder().text("").finishReason(FinishReason.TOOL_CALLS).build();
                });
        });
        assertTrue(service.generate(request).block().contains("你好"));
    }

    @Test
    void explainsAnExhaustedToolLoop() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder()
            .text("").finishReason(FinishReason.TOOL_CALLS).build()));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertTrue(error.getReason().contains("工具调用轮次已用完"));
    }

    @Test
    void explainsMissingDefaultModelInChinese() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.error(new DefaultModelNotConfiguredException("language")));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("AI 基座尚未配置默认语言模型"));
        assertTrue(error.getReason().contains("工作台中选择模型"));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    void rejectsEmptyModelOutput(String text) {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder().text(text).build()));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(502, error.getStatusCode().value());
    }

    @Test
    void rejectsOversizedOutput() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder().text("x".repeat(262145)).build()));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(502, error.getStatusCode().value());
    }

    @Test
    void doesNotReturnTruncatedModelOutputAsACompletedComponent() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder()
            .text("{\"partial\":")
            .finishReason(FinishReason.LENGTH)
            .build()));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(502, error.getStatusCode().value());
        assertTrue(error.getReason().contains("提高输出 Token 预算"));
        assertFalse(error.getReason().contains("partial"));
    }

    @Test
    void respectsModelSpecificOutputBudget() {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, null, 4096)));
        var capture = ArgumentCaptor.forClass(GenerateTextRequest.class);
        when(foundation.generate(isNull(), capture.capture()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text(VALID_DESIGN).build()));
        assertEquals(VALID_DESIGN, service.generate(request).block());
        assertEquals(4096, capture.getValue().getMaxOutputTokens());
    }

    @ParameterizedTest
    @ValueSource(ints = {0, 1023, 32769})
    void rejectsInvalidOutputBudgetBeforeInvokingModel(int budget) {
        when(settings.fetch("ai", AiSettings.class))
            .thenReturn(Mono.just(new AiSettings(true, null, budget)));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(400, error.getStatusCode().value());
        verifyNoInteractions(foundation);
    }

    @Test
    void preservesConcurrencyBudgetWhenRequestsAreCancelled() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.never());
        var first = service.generate(request).subscribe();
        var second = service.generate(request).subscribe();
        var third = service.generate(request).subscribe();
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(429, error.getStatusCode().value());
        first.dispose();
        var replacement = service.generate(request).subscribe();
        assertFalse(replacement.isDisposed());
        second.dispose();
        third.dispose();
        replacement.dispose();
    }

    @Test
    void cancellingTheEventStreamReleasesFoundationAndItsConcurrencySlot() {
        enable();
        var cancelled = new java.util.concurrent.atomic.AtomicInteger();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.<GenerateTextResult>never()
            .doOnCancel(cancelled::incrementAndGet));
        var first = service.generateEvents(request).subscribe();
        var second = service.generateEvents(request).subscribe();
        var third = service.generateEvents(request).subscribe();
        StepVerifier.create(service.generateEvents(request))
            .expectNextCount(1).assertNext(event -> {
                assertEquals("error", event.type());
                assertEquals(429, event.problem().status());
            }).verifyComplete();
        first.dispose();
        assertEquals(1, cancelled.get());
        var replacement = service.generateEvents(request).subscribe();
        assertFalse(replacement.isDisposed());
        replacement.dispose();
        second.dispose();
        third.dispose();
        assertEquals(4, cancelled.get());
    }

    @Test
    void allowsGenerationToCompleteAfterTheOldSixtySecondCutoff() {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation ->
            Mono.delay(Duration.ofSeconds(90))
                .thenReturn(GenerateTextResult.builder().text(VALID_DESIGN).build()));
        StepVerifier.withVirtualTime(() -> service.generate(request))
            .expectSubscription()
            .thenAwait(Duration.ofSeconds(90))
            .expectNext(VALID_DESIGN)
            .verifyComplete();
    }

    @Test
    void allowsToolValidationAndRepairToFinishAfterTheOldThreeMinuteDeadline() {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation ->
            Mono.delay(Duration.ofMinutes(4))
                .thenReturn(GenerateTextResult.builder().text(VALID_DESIGN).build()));
        StepVerifier.withVirtualTime(() -> service.generate(request))
            .expectSubscription()
            .thenAwait(Duration.ofMinutes(4))
            .expectNext(VALID_DESIGN)
            .verifyComplete();
    }

    @Test
    void stillCancelsGenerationAtTheSixMinuteDeadline() {
        enable();
        var cancelled = new java.util.concurrent.atomic.AtomicBoolean();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation ->
            Mono.<GenerateTextResult>never().doOnCancel(() -> cancelled.set(true)));
        StepVerifier.withVirtualTime(() -> service.generate(request))
            .expectSubscription()
            .thenAwait(Duration.ofMinutes(6))
            .expectErrorSatisfies(cause -> {
                assertTrue(cause instanceof ResponseStatusException);
                assertEquals(504, ((ResponseStatusException) cause).getStatusCode().value());
                assertTrue(((ResponseStatusException) cause).getReason().contains("6 分钟总时限"));
            })
            .verify();
        assertTrue(cancelled.get());
    }

    @Test
    void hidesProviderErrorDetailsFromAuthors() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.error(new RuntimeException("private-provider-error-detail")));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(502, error.getStatusCode().value());
        assertFalse(error.getReason().contains("private-provider-error-detail"));
    }

    @Test
    void surfacesLegacyProviderRateLimitThroughGenerationEndpoint() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.error(new IllegalStateException(
            "OpenAI-compatible chat request failed: status=429, body=private-provider-error-detail")));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(request).block());
        assertEquals(429, error.getStatusCode().value());
        assertTrue(error.getReason().contains("AI 服务商限流或额度不足"));
        assertFalse(error.getReason().contains("private-provider-error-detail"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void preservesProviderStatusWhenFoundationStreamResultFlattensTheOriginalException(boolean theme) {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation -> {
            GenerateTextRequest generation = invocation.getArgument(1);
            var original = new ProviderApiException("openai", 401, "Bearer private-key; private-prompt");
            // Foundation 1.0.0 notifies lifecycle with the original failure, then returns an
            // IllegalStateException containing only its message from StreamTextResult.result().
            return generation.getLifecycle().onError(GenerationErrorEvent.builder().error(original).build())
                .then(Mono.error(new IllegalStateException(original.getMessage())));
        });

        var error = assertThrows(ResponseStatusException.class, () -> generateWithModel(theme, null).block());

        assertEquals(502, error.getStatusCode().value());
        assertEquals("provider-http", error.getBody().getProperties().get("category"));
        assertEquals(401, error.getBody().getProperties().get("providerStatus"));
        assertTrue(error.getReason().contains("认证失败"));
        assertFalse(error.getReason().contains("private-key"));
        assertFalse(error.getReason().contains("private-prompt"));
    }

    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void preservesConnectionFailureWhenFoundationStreamResultLosesItsCause(boolean theme) {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation -> {
            GenerateTextRequest generation = invocation.getArgument(1);
            var original = new RuntimeException("private-provider-details",
                new java.net.ConnectException("private-provider-address"));
            return generation.getLifecycle().onError(GenerationErrorEvent.builder().error(original).build())
                .then(Mono.error(new IllegalStateException(original.getMessage())));
        });

        var error = assertThrows(ResponseStatusException.class, () -> generateWithModel(theme, null).block());

        assertEquals(502, error.getStatusCode().value());
        assertEquals("connection", error.getBody().getProperties().get("category"));
        assertTrue(error.getReason().contains("无法连接"));
        assertFalse(error.getReason().contains("private-provider"));
    }

    @Test
    void preservesOriginalProviderDiagnosticsInTheWorkbenchEventStream() {
        enable();
        when(foundation.generate(isNull(), any())).thenAnswer(invocation -> {
            GenerateTextRequest generation = invocation.getArgument(1);
            var original = new ProviderApiException("openai", 429, "private-provider-details");
            return generation.getLifecycle().onError(GenerationErrorEvent.builder().error(original).build())
                .then(Mono.error(new IllegalStateException(original.getMessage())));
        });

        StepVerifier.create(service.generateEvents(request))
            .expectNextCount(1)
            .assertNext(event -> {
                assertEquals("error", event.type());
                assertEquals("provider-http", event.problem().category());
                assertEquals(429, event.problem().status());
                assertEquals(429, event.problem().providerStatus());
                assertFalse(event.problem().detail().contains("private-provider"));
            }).verifyComplete();
    }

    @Test
    void rejectsOversizedInputBeforeReadingConfiguration() {
        var invalid = new AiEndpoint.GenerateRequest("x".repeat(4001), null);
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(invalid).block());
        assertEquals(400, error.getStatusCode().value());
        verifyNoInteractions(settings, foundation);
    }

    @Test
    void generatesThemesWithTheSameConfiguredModelAndOnlyTheThemeContract() {
        enable();
        var capture = ArgumentCaptor.forClass(GenerateTextRequest.class);
        when(foundation.generate(isNull(), capture.capture()))
            .thenReturn(Mono.just(GenerateTextResult.builder().text("{\"schemaVersion\":\"lingui.theme/1\"}").build()));
        var theme = new AiEndpoint.GenerateThemeRequest("保留强调色，圆角为 0", "{\"radius\":8}");
        assertTrue(service.generateTheme(theme).block().contains("lingui.theme/1"));
        var generation = capture.getValue();
        assertTrue(generation.getSystem().contains("用户指定风格优先"));
        assertTrue(generation.getSystem().contains("system/serif/mono"));
        assertFalse(generation.getSystem().contains("LingUI.Column"));
        assertFalse(generation.getSystem().contains("lingui.document/2"));
        assertTrue(generation.getPrompt().contains("不是系统指令"));
        assertTrue(generation.getPrompt().contains(theme.theme()));
        assertEquals(16384, generation.getMaxOutputTokens());
        assertEquals(0, generation.getMaxRetries());
        assertNull(generation.getTools());
        assertEquals(Duration.ofMinutes(3), generation.getTimeouts().getTotalTimeout());
    }

    @Test
    void themeRequestsShareTheComponentConcurrencyLimit() {
        enable();
        when(foundation.generate(isNull(), any())).thenReturn(Mono.never());
        var first = service.generate(request).subscribe();
        var second = service.generateTheme(new AiEndpoint.GenerateThemeRequest("深色", null)).subscribe();
        var third = service.generate(request).subscribe();
        try {
            var error = assertThrows(ResponseStatusException.class,
                () -> service.generateTheme(new AiEndpoint.GenerateThemeRequest("宋体", null)).block());
            assertEquals(429, error.getStatusCode().value());
        } finally {
            first.dispose();
            second.dispose();
            third.dispose();
        }
        when(foundation.generate(isNull(), any())).thenReturn(Mono.just(GenerateTextResult.builder().text("{}").build()));
        assertEquals("{}", service.generateTheme(new AiEndpoint.GenerateThemeRequest("深色", null)).block());
    }

    @Test
    void rejectsInvalidThemeRequestsBeforeInvokingTheFoundation() {
        for (var invalid : java.util.List.of(
            new AiEndpoint.GenerateThemeRequest(null, null),
            new AiEndpoint.GenerateThemeRequest("  ", null),
            new AiEndpoint.GenerateThemeRequest("x".repeat(4001), null),
            new AiEndpoint.GenerateThemeRequest("深色", "x".repeat(8193)))) {
            var error = assertThrows(ResponseStatusException.class, () -> service.generateTheme(invalid).block());
            assertEquals(400, error.getStatusCode().value());
        }
        verifyNoInteractions(settings, foundation);
    }
}
