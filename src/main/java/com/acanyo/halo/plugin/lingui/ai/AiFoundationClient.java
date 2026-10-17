package com.acanyo.halo.plugin.lingui.ai;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.aifoundation.AiModelService;
import run.halo.aifoundation.chat.GenerateTextRequest;
import run.halo.aifoundation.chat.GenerateTextResult;
import run.halo.app.plugin.extensionpoint.ExtensionGetter;

/** Cross-plugin service access uses Halo's extension system, not Spring injection. */
@Component
public class AiFoundationClient {
    private final ExtensionGetter extensions;

    public AiFoundationClient(ExtensionGetter extensions) {
        this.extensions = extensions;
    }

    public Mono<GenerateTextResult> generate(String modelName, GenerateTextRequest request) {
        return extensions.getEnabledExtension(AiModelService.class)
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "AI 基座未启用，请先安装并启用 AI Foundation 1.x")))
            .flatMap(service -> modelName == null || modelName.isBlank()
                ? service.languageModel() : service.languageModel(modelName))
            // Consume the SDK stream once and return only its completed result. The non-streaming
            // OpenAI-compatible adapter in Foundation 1.0.0 cuts slow calls off after 60 seconds.
            .flatMap(model -> Mono.defer(() -> model.streamText(request).result()));
    }
}
