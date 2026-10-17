package com.acanyo.halo.plugin.lingui.market;

import static org.junit.jupiter.api.Assertions.*;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.client.ClientRequest;
import org.springframework.web.reactive.function.client.ClientResponse;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

class MarketClientTest {
    @Test void keepsCredentialsOutOfPublicRequestsAndEncodesSearch() {
        var request = new AtomicReference<ClientRequest>();
        var market = new MarketClient(WebClient.builder().baseUrl(MarketClient.SITE).exchangeFunction(r -> {
            request.set(r);
            return Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", "application/json")
                .body("{\"items\":[],\"total\":0,\"page\":1,\"size\":9}").build());
        }).build());
        StepVerifier.create(market.list(1, 9, "hello & world")).assertNext(page -> assertEquals(0, page.total())).verifyComplete();
        assertNull(request.get().headers().getFirst("Authorization"));
        assertEquals("auth.lik.cc", request.get().url().getHost());
        assertTrue(request.get().url().getRawQuery().contains("%26"));
    }
    @Test void sendsTokenOnlyToDesignatedMarketAndSanitizesForbiddenResponse() {
        var request = new AtomicReference<ClientRequest>();
        var market = new MarketClient(WebClient.builder().baseUrl(MarketClient.SITE).exchangeFunction(r -> {
            request.set(r);
            return Mono.just(ClientResponse.create(HttpStatus.FORBIDDEN).header("Content-Type", "application/json")
                .body("{\"secret\":\"sensitive-upstream-diagnostic\"}").build());
        }).build());
        StepVerifier.create(market.mine("test-credential", 1, 9)).expectErrorSatisfies(e -> {
            var failure = assertInstanceOf(ResponseStatusException.class, e);
            assertEquals(HttpStatus.FORBIDDEN, failure.getStatusCode());
            assertFalse(failure.getMessage().contains("sensitive"));
            assertFalse(failure.getMessage().contains("test-credential"));
        }).verify();
        assertEquals("Bearer test-credential", request.get().headers().getFirst("Authorization"));
    }
    @Test void refusesRedirectsAndHtmlEvenWhenTheyLookSuccessful() {
        var redirect = new MarketClient(WebClient.builder().baseUrl(MarketClient.SITE).exchangeFunction(r ->
            Mono.just(ClientResponse.create(HttpStatus.FOUND).header("Location", "https://other.invalid").build())).build());
        StepVerifier.create(redirect.user("test-credential")).expectErrorSatisfies(e ->
            assertEquals(HttpStatus.BAD_REQUEST, ((ResponseStatusException)e).getStatusCode())).verify();
        var html = new MarketClient(WebClient.builder().baseUrl(MarketClient.SITE).exchangeFunction(r ->
            Mono.just(ClientResponse.create(HttpStatus.OK).header("Content-Type", MediaType.TEXT_HTML_VALUE).body("login").build())).build());
        StepVerifier.create(html.list(1,9,"")).expectErrorSatisfies(e ->
            assertEquals(HttpStatus.BAD_GATEWAY, ((ResponseStatusException)e).getStatusCode())).verify();
    }
    @Test void failedMutationsRequireResultReconciliationAndAreNotRetried() {
        var calls = new java.util.concurrent.atomic.AtomicInteger();
        var market = new MarketClient(WebClient.builder().baseUrl(MarketClient.SITE).exchangeFunction(r -> {
            calls.incrementAndGet(); return Mono.error(new IllegalStateException("private networking details"));
        }).build());
        StepVerifier.create(market.submit("test-credential", null, new MarketDtos.MarketSubmitRequest("{}",null)))
            .expectErrorSatisfies(e -> { assertTrue(e.getMessage().contains("核对")); assertFalse(e.getMessage().contains("private")); }).verify();
        assertEquals(1,calls.get());
    }
}
