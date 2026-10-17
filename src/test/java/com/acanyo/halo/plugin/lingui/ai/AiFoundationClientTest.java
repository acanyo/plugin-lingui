package com.acanyo.halo.plugin.lingui.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.aifoundation.AiModelService;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerateTextResult;
import run.halo.aifoundation.chat.LanguageModel;
import run.halo.aifoundation.chat.StreamTextResult;
import run.halo.app.plugin.extensionpoint.ExtensionGetter;

class AiFoundationClientTest {
    private final ExtensionGetter extensions = mock(ExtensionGetter.class);
    private final AiModelService models = mock(AiModelService.class);
    private final LanguageModel model = mock(LanguageModel.class);
    private final AiFoundationClient client = new AiFoundationClient(extensions);
    private final GenerateTextRequest request = GenerateTextRequest.builder().prompt("生成组件").build();

    private void returnsCompletedStream() {
        var stream = mock(StreamTextResult.class);
        when(model.streamText(request)).thenReturn(stream);
        when(stream.result()).thenReturn(Mono.just(GenerateTextResult.builder().text("{}").build()));
    }

    @Test
    void resolvesNamedModelByResourceNameThroughHaloExtension() {
        when(extensions.getEnabledExtension(AiModelService.class)).thenReturn(Mono.just(models));
        when(models.languageModel("author-language-model")).thenReturn(Mono.just(model));
        returnsCompletedStream();
        assertEquals("{}", client.generate("author-language-model", request).block().getText());
        verify(models).languageModel("author-language-model");
        verify(model).streamText(request);
        verify(model, never()).generateText(request);
    }

    @Test
    void resolvesFoundationDefaultWhenNoModelIsSelected() {
        when(extensions.getEnabledExtension(AiModelService.class)).thenReturn(Mono.just(models));
        when(models.languageModel()).thenReturn(Mono.just(model));
        returnsCompletedStream();
        assertEquals("{}", client.generate(null, request).block().getText());
        verify(models).languageModel();
    }

    @Test
    void reportsFoundationUnavailableWithoutFallingBackToDirectProviderCalls() {
        when(extensions.getEnabledExtension(AiModelService.class)).thenReturn(Mono.empty());
        var error = assertThrows(ResponseStatusException.class, () -> client.generate(null, request).block());
        assertEquals(503, error.getStatusCode().value());
        assertEquals("AI 基座未启用，请先安装并启用 AI Foundation 1.x", error.getReason());
    }

    @Test
    void cancellingCallerCancelsTheStreamResultSubscription() {
        var cancelled = new java.util.concurrent.atomic.AtomicBoolean();
        var stream = mock(StreamTextResult.class);
        when(extensions.getEnabledExtension(AiModelService.class)).thenReturn(Mono.just(models));
        when(models.languageModel()).thenReturn(Mono.just(model));
        when(model.streamText(request)).thenReturn(stream);
        when(stream.result()).thenReturn(Mono.<GenerateTextResult>never()
            .doOnCancel(() -> cancelled.set(true)));
        var subscriber = client.generate(null, request).subscribe();
        subscriber.dispose();
        assertTrue(cancelled.get());
        verify(model).streamText(request);
        verify(model, never()).generateText(request);
    }
}
