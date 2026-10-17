package com.acanyo.halo.plugin.lingui.ai.progress;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class GenerationStreamTest {
    @Test
    void emitsProgressAndHeartbeatBeforeTheResultAndPreservesSubscriberContext() {
        StepVerifier.withVirtualTime(() -> GenerationStream.create(progress -> Mono.deferContextual(context -> {
            assertEquals("author", context.get("principal"));
            progress.activity("model-0", "模型生成设计", "running");
            return Mono.delay(Duration.ofSeconds(12)).thenReturn("design");
        })).contextWrite(context -> context.put("principal", "author")))
            .assertNext(event -> assertEquals("prepare", event.id()))
            .assertNext(event -> assertEquals("model-0", event.id()))
            .thenAwait(Duration.ofSeconds(10))
            .assertNext(event -> assertEquals("heartbeat", event.type()))
            .thenAwait(Duration.ofSeconds(2))
            .assertNext(event -> {
                assertEquals("result", event.type());
                assertEquals("design", event.content());
            }).verifyComplete();
    }

    @Test
    void disconnectCancelsTheUnderlyingGeneration() {
        var cancelled = new AtomicBoolean();
        StepVerifier.create(GenerationStream.create(progress ->
            Mono.<String>never().doOnCancel(() -> cancelled.set(true))))
            .expectNextCount(1).thenCancel().verify();
        assertTrue(cancelled.get());
    }

    @Test
    void endsAnEmptyResponseInsteadOfSendingHeartbeatsForever() {
        StepVerifier.create(GenerationStream.create(progress -> Mono.empty()))
            .expectNextCount(1).assertNext(event -> {
                assertEquals("error", event.type());
                assertTrue(event.problem().detail().contains("未返回设计"));
            }).verifyComplete();
    }

    @Test
    void sendsOnlyWhitelistedProblemPropertiesAfterHeadersHaveBeenCommitted() {
        var problem = new ResponseStatusException(HttpStatus.BAD_GATEWAY, "服务商认证失败");
        problem.getBody().setProperty("reference", "12345678");
        problem.getBody().setProperty("providerStatus", 401);
        problem.getBody().setProperty("privateBody", "secret");
        StepVerifier.create(GenerationStream.create(progress -> Mono.error(problem)))
            .expectNextCount(1).assertNext(event -> {
                assertEquals("error", event.type());
                assertEquals(401, event.problem().providerStatus());
                assertEquals("12345678", event.problem().reference());
                assertFalse(event.toString().contains("secret"));
            }).verifyComplete();
        StepVerifier.create(GenerationStream.create(progress -> Mono.error(new RuntimeException("secret"))))
            .expectNextCount(1).assertNext(event -> assertFalse(event.toString().contains("secret")))
            .verifyComplete();
    }
}
