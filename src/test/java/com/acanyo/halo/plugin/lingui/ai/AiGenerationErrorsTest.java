package com.acanyo.halo.plugin.lingui.ai;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.ConnectException;
import java.time.Duration;
import java.util.concurrent.TimeoutException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import run.halo.aifoundation.exception.AiGenerationTimeoutException;
import run.halo.aifoundation.exception.DefaultModelNotConfiguredException;
import run.halo.aifoundation.exception.ProviderApiException;

class AiGenerationErrorsTest {
    @Test
    void explainsUnsupportedToolsWithoutLeakingTheProviderMessage() {
        var error = AiGenerationErrors.translate(new IllegalArgumentException(
            "Tool calling is not supported by provider type: private-name"));
        assertEquals(400, error.getStatusCode().value());
        assertTrue(error.getReason().contains("Function Calling"));
        assertFalse(error.getReason().contains("private-name"));
    }

    private static final String PRIVATE_BODY = "Bearer private-credential; private-prompt";

    @ParameterizedTest
    @CsvSource({
        "400, 502, 兼容性",
        "401, 502, 认证失败",
        "403, 502, 账号权限",
        "404, 502, 模型不存在",
        "408, 504, 响应超时",
        "413, 502, 分步修改",
        "422, 502, 输出长度",
        "429, 429, 额度",
        "500, 502, 暂时异常",
        "503, 502, 暂时异常",
        "504, 504, 响应超时"
    })
    void explainsProviderStatusWithoutReturningItsBody(int providerStatus, int responseStatus,
        String expected) {
        var cause = new ProviderApiException("openai", providerStatus, PRIVATE_BODY);
        var error = AiGenerationErrors.translate(new RuntimeException("wrapped", cause));
        assertEquals(responseStatus, error.getStatusCode().value());
        assertTrue(error.getReason().contains(expected));
        assertTrue(error.getReason().contains("HTTP " + providerStatus));
        assertTrue(error.getReason().matches(".*诊断编号：[a-f0-9]{8}.*"));
        assertFalse(error.getReason().contains(PRIVATE_BODY));
        assertNull(error.getCause());
    }

    @Test
    void readsInstalledFoundationLegacyStatusBeforeItsPrivateBody() {
        var cause = new IllegalStateException(
            "OpenAI-compatible chat request failed: status=429, body=" + PRIVATE_BODY);
        var failure = AiGenerationErrors.classify(new RuntimeException(cause));
        assertEquals(429, failure.providerStatus());
        assertEquals("provider-http", failure.category());
        assertFalse(failure.reason().contains(PRIVATE_BODY));
    }

    @Test
    void recognizesTheInstalledFoundationTransportExceptionWithoutLeakingItsBody() {
        var cause = new run.halo.aifoundation.provider.transport.ProviderHttpException(
            "openai-compatible chat request failed: status=503, body="
                + "{\"error\":{\"code\":\"model_not_found\",\"message\":\"private-channel-details\"}}; " + PRIVATE_BODY);

        var error = AiGenerationErrors.translate(new RuntimeException("wrapped", cause));

        assertEquals(502, error.getStatusCode().value());
        assertEquals("provider-http", error.getBody().getProperties().get("category"));
        assertEquals(503, error.getBody().getProperties().get("providerStatus"));
        assertTrue(error.getReason().contains("HTTP 503"));
        assertTrue(error.getReason().contains("工作台切换模型"));
        assertFalse(error.getReason().contains("model_not_found"));
        assertFalse(error.getReason().contains("private-channel-details"));
        assertFalse(error.getReason().contains(PRIVATE_BODY));
        assertNull(error.getCause());
    }

    @Test
    void recognizesLowercaseTransportStatusAfterAnOlderStreamFlattensTheException() {
        var failure = AiGenerationErrors.classify(new IllegalStateException(
            "openai-compatible chat request failed: status=503, body=" + PRIVATE_BODY));

        assertEquals("provider-http", failure.category());
        assertEquals(503, failure.providerStatus());
        assertFalse(failure.reason().contains(PRIVATE_BODY));
    }

    @ParameterizedTest
    @ValueSource(strings = {
        "private-prefix openai-compatible chat request failed: status=503, body=private",
        "openai-compatible chat request failed: status=5030, body=private",
        "openai-compatible chat request failed: status=503private",
        "openai-compatible chat request failed: status=099, body=private",
        "openai-compatible chat request failed: status=600, body=private",
        "openai-compatible chat request failed: status=503\nprivate",
        "openai-compatible chat request failed: status=503\n"
    })
    void doesNotInferTransportStatusFromMalformedMessages(String message) {
        var failure = AiGenerationErrors.classify(
            new run.halo.aifoundation.provider.transport.ProviderHttpException(message));

        assertEquals("unknown", failure.category());
        assertEquals(0, failure.providerStatus());
        assertFalse(failure.reason().contains("private"));
    }

    @Test
    void doesNotTrustTheTransportMessageFormatOnUnrelatedExceptionTypes() {
        var failure = AiGenerationErrors.classify(new RuntimeException(
            "openai-compatible chat request failed: status=503, body=" + PRIVATE_BODY));

        assertEquals("unknown", failure.category());
        assertEquals(0, failure.providerStatus());
    }

    @Test
    void doesNotInferHttpStatusFromArbitraryExceptionText() {
        var cause = new IllegalStateException("private-prompt status=401, body=" + PRIVATE_BODY);
        var failure = AiGenerationErrors.classify(cause);
        assertEquals("unknown", failure.category());
        assertFalse(failure.reason().contains("认证失败"));
    }

    @Test
    void supportsWebClientStatusWithoutReturningHeadersOrBody() {
        var cause = WebClientResponseException.create(403, "Forbidden", HttpHeaders.EMPTY,
            PRIVATE_BODY.getBytes(java.nio.charset.StandardCharsets.UTF_8), null);
        var failure = AiGenerationErrors.classify(cause);
        assertEquals(403, failure.providerStatus());
        assertTrue(failure.reason().contains("账号权限"));
        assertFalse(failure.reason().contains(PRIVATE_BODY));
    }

    @Test
    void recognizesWrappedFoundationAndBlockingTimeouts() {
        var foundation = new AiGenerationTimeoutException("step", Duration.ofSeconds(60),
            new TimeoutException(PRIVATE_BODY));
        var blocking = new IllegalStateException("Timeout on blocking read",
            new TimeoutException(PRIVATE_BODY));
        assertEquals("timeout", AiGenerationErrors.classify(foundation).category());
        assertEquals("timeout", AiGenerationErrors.classify(blocking).category());
    }

    @Test
    void distinguishesConnectivityFromConfigurationErrors() {
        var connection = new RuntimeException(new ConnectException(PRIVATE_BODY));
        var defaultModel = new RuntimeException(new DefaultModelNotConfiguredException("language"));
        assertEquals("connection", AiGenerationErrors.classify(connection).category());
        assertEquals("default-model", AiGenerationErrors.classify(defaultModel).category());
        assertFalse(AiGenerationErrors.classify(connection).reason().contains(PRIVATE_BODY));
    }

    @Test
    void safelyStopsAtCyclicCauses() {
        var first = new RuntimeException(PRIVATE_BODY);
        var second = new RuntimeException(PRIVATE_BODY, first);
        first.initCause(second);
        assertEquals("unknown", AiGenerationErrors.classify(first).category());
    }
}
