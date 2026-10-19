package com.acanyo.halo.plugin.lingui.ai;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import run.halo.aifoundation.exception.ProviderApiException;

class AiEndpointTest {
    @Test
    void returnsOnlyTheInitialModelForWorkbenchGenerationSettings() {
        var service = mock(AiService.class);
        when(service.generationSettings()).thenReturn(Mono.just(new AiEndpoint.GenerationSettings("legacy-model")));

        WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build()
            .get().uri("/generation-settings").exchange().expectStatus().isOk()
            .expectBody().json("{\"modelName\":\"legacy-model\"}", true);
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "generate-theme"})
    void forwardsAnExplicitModelFromTheWorkbench(String path) {
        var service = mock(AiService.class);
        when(service.generate(any())).thenReturn(Mono.just("result"));
        when(service.generateTheme(any())).thenReturn(Mono.just("result"));

        WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build()
            .post().uri("/" + path).contentType(MediaType.APPLICATION_JSON)
            .bodyValue("{\"instruction\":\"test\",\"modelName\":\"workbench-model\"}")
            .exchange().expectStatus().isOk();

        if (path.equals("generate")) {
            org.mockito.Mockito.verify(service).generate(new AiEndpoint.GenerateRequest("test", null, "workbench-model"));
        } else {
            org.mockito.Mockito.verify(service).generateTheme(new AiEndpoint.GenerateThemeRequest("test", null, "workbench-model"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "generate-theme"})
    void preservesNullForAnOmittedOrNullModelAndEmptyForAnExplicitDefault(String path) {
        var service = mock(AiService.class);
        when(service.generate(any())).thenReturn(Mono.just("result"));
        when(service.generateTheme(any())).thenReturn(Mono.just("result"));
        var client = WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build();

        for (var json : java.util.List.of("{\"instruction\":\"test\"}",
            "{\"instruction\":\"test\",\"modelName\":null}", "{\"instruction\":\"test\",\"modelName\":\"\"}")) {
            client.post().uri("/" + path).contentType(MediaType.APPLICATION_JSON)
                .bodyValue(json).exchange().expectStatus().isOk();
        }

        if (path.equals("generate")) {
            org.mockito.Mockito.verify(service, org.mockito.Mockito.times(2))
                .generate(new AiEndpoint.GenerateRequest("test", null, null));
            org.mockito.Mockito.verify(service).generate(new AiEndpoint.GenerateRequest("test", null, ""));
        } else {
            org.mockito.Mockito.verify(service, org.mockito.Mockito.times(2))
                .generateTheme(new AiEndpoint.GenerateThemeRequest("test", null, null));
            org.mockito.Mockito.verify(service).generateTheme(new AiEndpoint.GenerateThemeRequest("test", null, ""));
        }
    }

    @Test
    void negotiatesPostProgressStreamAndPreservesTheJsonResponse() {
        var service = mock(AiService.class);
        var request = new AiEndpoint.GenerateRequest("test", null);
        when(service.generateEvents(request)).thenReturn(reactor.core.publisher.Flux.just(
            new com.acanyo.halo.plugin.lingui.ai.progress.GenerationEvent(
                "activity", "model-0", "模型生成设计", "running", 0, null, null),
            new com.acanyo.halo.plugin.lingui.ai.progress.GenerationEvent(
                "result", "result", "完成", "done", 5, "design-json", null)));
        when(service.generate(request)).thenReturn(Mono.just("design-json"));
        var client = WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build();
        client.post().uri("/generate").contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.parseMediaType("text/event-stream;q=0.9"))
            .bodyValue(request).exchange().expectStatus().isOk()
            .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_EVENT_STREAM)
            .expectHeader().valueEquals("X-Accel-Buffering", "no")
            .expectBody(String.class).value(body -> {
                org.junit.jupiter.api.Assertions.assertTrue(body.contains("event:activity"));
                org.junit.jupiter.api.Assertions.assertTrue(body.contains("event:result"));
            });
        client.post().uri("/generate").contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.ALL).bodyValue(request).exchange().expectStatus().isOk()
            .expectBody().jsonPath("$.content").isEqualTo("design-json");
    }

    @ParameterizedTest
    @ValueSource(strings = {"generate", "generate-theme"})
    void returnsUsefulSafeProblemDetailsEvenWhenHaloHidesExceptionMessages(String path) {
        var service = mock(AiService.class);
        var error = AiGenerationErrors.translate(new ProviderApiException("openai", 401,
            "Bearer private-key; user-private-prompt"));
        when(service.generate(any())).thenReturn(Mono.error(error));
        when(service.generateTheme(any())).thenReturn(Mono.error(error));
        WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build()
            .post().uri("/" + path).contentType(MediaType.APPLICATION_JSON)
            .bodyValue(new AiEndpoint.GenerateRequest("test", null)).exchange()
            .expectStatus().isEqualTo(502)
            .expectHeader().contentType(MediaType.APPLICATION_PROBLEM_JSON)
            .expectBody().jsonPath("$.detail").isEqualTo(error.getReason())
            .jsonPath("$.providerStatus").isEqualTo(401)
            .jsonPath("$.category").isEqualTo("provider-http")
            .jsonPath("$.reference").value(value -> org.junit.jupiter.api.Assertions.assertTrue(
                value.toString().matches("[a-f0-9]{8}")))
            .consumeWith(result -> org.junit.jupiter.api.Assertions.assertFalse(
                new String(result.getResponseBody(), java.nio.charset.StandardCharsets.UTF_8)
                    .contains("private-key")));
    }

    @Test
    void routesThemeRequestsToTheThemeGenerationContract() {
        var service = mock(AiService.class);
        var request = new AiEndpoint.GenerateThemeRequest("宋体，圆角 0", "{\"font\":\"system\"}");
        when(service.generateTheme(request)).thenReturn(Mono.just("theme-json"));
        WebTestClient.bindToRouterFunction(new AiEndpoint(service).endpoint()).build()
            .post().uri("/generate-theme").contentType(MediaType.APPLICATION_JSON)
            .bodyValue(request).exchange().expectStatus().isOk()
            .expectBody().jsonPath("$.content").isEqualTo("theme-json");
        org.mockito.Mockito.verify(service).generateTheme(request);
    }
}
