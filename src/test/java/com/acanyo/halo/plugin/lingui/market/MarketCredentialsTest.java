package com.acanyo.halo.plugin.lingui.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Secret;

class MarketCredentialsTest {
    @Test void verifiesIdentityAndPermissionBeforeSavingAndReturnsNoToken() {
        var client = mock(ReactiveExtensionClient.class); var market = mock(MarketClient.class);
        when(market.user("credential")).thenReturn(Mono.just(new MarketDtos.MarketUser("author","作者")));
        when(market.mine("credential",1,1)).thenReturn(Mono.just(new MarketDtos.MyMarketPage(java.util.List.of(),0,1,1)));
        when(client.fetch(eq(Secret.class),anyString())).thenReturn(Mono.empty());
        when(client.create(any(Secret.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        StepVerifier.create(new MarketCredentials(client,market).connect("local-author", new MarketDtos.MarketConnectRequest("credential")))
            .assertNext(status -> { assertEquals("author",status.username()); assertTrue(status.connected()); assertFalse(status.toString().contains("credential")); })
            .verifyComplete();
        var captor = org.mockito.ArgumentCaptor.forClass(Secret.class);
        verify(client).create(captor.capture());
        assertEquals(MarketCredentials.name("local-author"),captor.getValue().getMetadata().getName());
        assertEquals("credential",captor.getValue().getStringData().get("token"));
        assertNotEquals(MarketCredentials.name("other-author"),captor.getValue().getMetadata().getName());
    }
    @Test void rejectsInvalidTokensWithoutContactingMarketAndDoesNotOverwriteOnFailedVerification() {
        var client=mock(ReactiveExtensionClient.class); var market=mock(MarketClient.class);
        var credentials=new MarketCredentials(client,market);
        StepVerifier.create(credentials.connect("a",new MarketDtos.MarketConnectRequest("invalid\r\nheader")))
            .expectError(ResponseStatusException.class).verify();
        verifyNoInteractions(client,market);
        when(market.user("credential")).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED)));
        StepVerifier.create(credentials.connect("a",new MarketDtos.MarketConnectRequest("credential")))
            .expectError(ResponseStatusException.class).verify();
        verifyNoInteractions(client);
    }
    @Test void isolatedReadsFailClosedAndSupportHalosBinarySecretStorage() {
        var client=mock(ReactiveExtensionClient.class); var market=mock(MarketClient.class);
        var secret=new Secret(); secret.setMetadata(new run.halo.app.extension.Metadata());
        secret.setData(Map.of("token","stored-credential".getBytes(StandardCharsets.UTF_8)));
        when(client.fetch(Secret.class,MarketCredentials.name("a"))).thenReturn(Mono.just(secret));
        when(client.fetch(Secret.class,MarketCredentials.name("b"))).thenReturn(Mono.empty());
        var credentials=new MarketCredentials(client,market);
        StepVerifier.create(credentials.token("a")).expectNext("stored-credential").verifyComplete();
        StepVerifier.create(credentials.token("b")).expectError(ResponseStatusException.class).verify();
        StepVerifier.create(credentials.status("b")).assertNext(status -> assertFalse(status.connected())).verifyComplete();
    }
}
