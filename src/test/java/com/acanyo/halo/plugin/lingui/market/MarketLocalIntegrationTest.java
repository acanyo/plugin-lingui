package com.acanyo.halo.plugin.lingui.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Secret;

/** Opt-in live check against the isolated local market; never writes to a production site. */
@EnabledIfEnvironmentVariable(named = "LINGUI_RUN_LOCAL_MARKET_TEST", matches = "1")
class MarketLocalIntegrationTest {
    private static final Duration WAIT = Duration.ofSeconds(25);
    @Test void connectsSubmitsWithdrawsRevisesAndImportsPublishedSnapshots() throws Exception {
        var mapper = new ObjectMapper();
        var pat = mapper.readTree(Files.readString(Path.of("/tmp/lingui-local-bridge-pat.json")));
        var token = pat.path("metadata").path("annotations").path("security.halo.run/access-token").asText();
        assertFalse(token.isBlank());
        var local = WebClient.builder().baseUrl("http://127.0.0.1:8091").build();
        var market = new MarketClient(local);
        var client = mock(ReactiveExtensionClient.class);
        var secrets = new HashMap<String,Secret>();
        when(client.fetch(eq(Secret.class),anyString())).thenAnswer(i -> Mono.justOrEmpty(secrets.get(i.getArgument(1))));
        when(client.create(any(Secret.class))).thenAnswer(i -> { Secret s=i.getArgument(0);secrets.put(s.getMetadata().getName(),s);return Mono.just(s); });
        when(client.delete(any(Secret.class))).thenAnswer(i -> { Secret s=i.getArgument(0);secrets.remove(s.getMetadata().getName());return Mono.just(s); });
        var credentials = new MarketCredentials(client,market);
        assertTrue(credentials.connect("qa-local-author",new MarketConnectRequest(token)).block(WAIT).connected());
        assertFalse(credentials.status("other-local-author").block(WAIT).connected());
        var connected = credentials.token("qa-local-author").block(WAIT);
        String name = null;
        try {
            var instance = mapper.readTree(getClass().getResourceAsStream("/market/quiz.json")).path("instance");
            var work = mapper.createObjectNode();
            work.put("schemaVersion","lingui.marketplace/1"); work.put("title","qa-lingui-bridge-check");
            work.put("description","本地远程市场接入验收"); work.put("category","内容表达"); work.put("author","测试作者");
            work.put("version","1.0.0"); work.put("license","MIT"); work.put("notes",""); work.set("instance",instance);
            var submitted = market.submit(connected,null,new MarketSubmitRequest(work.toString(),null)).block(WAIT);
            name=submitted.name(); assertEquals("PENDING",submitted.revisions().getLast().status());
            assertTrue(market.mine(connected,1,9).block(WAIT).items().stream().anyMatch(w -> w.title().equals("qa-lingui-bridge-check")));
            var finalName=name;
            assertEquals(HttpStatus.NOT_FOUND,assertThrows(ResponseStatusException.class,() -> market.get(finalName).block(WAIT)).getStatusCode());
            var withdrawn=market.withdraw(connected,name,new MarketVersionRequest(submitted.resourceVersion())).block(WAIT);
            assertEquals("WITHDRAWN",withdrawn.revisions().getLast().status());
            assertEquals(HttpStatus.CONFLICT,assertThrows(ResponseStatusException.class,() -> market.submit(connected,finalName,new MarketSubmitRequest(work.toString(),submitted.resourceVersion())).block(WAIT)).getStatusCode());
            var again=market.submit(connected,name,new MarketSubmitRequest(work.toString(),withdrawn.resourceVersion())).block(WAIT);
            var approved=local.post().uri("/apis/console.api.market.lingui.dev/v1alpha1/works/{name}/review",name)
                .headers(h -> h.setBearerAuth(token)).bodyValue(Map.of("expectedVersion",again.resourceVersion(),"revisionId",again.revisions().getLast().id(),"decision","APPROVED","note","本地接入检查"))
                .retrieve().bodyToMono(MyMarketDetail.class).block(WAIT);
            local.post().uri("/apis/console.api.market.lingui.dev/v1alpha1/works/{name}/publication",name)
                .headers(h -> h.setBearerAuth(token)).bodyValue(Map.of("expectedVersion",approved.resourceVersion(),"revisionId",approved.revisions().getLast().id(),"note","本地接入检查"))
                .retrieve().bodyToMono(MyMarketDetail.class).block(WAIT);
            var published=market.get(name).block(WAIT);
            assertEquals("1.0.0",published.work().version());
            assertEquals(instance,mapper.readTree(published.packageJson()).path("instance"));
            assertFalse(market.list(1,9,"qa-lingui-bridge-check").block(WAIT).items().isEmpty());
            var latest=market.mine(connected,name).block(WAIT);
            work.put("version","2.0.0");
            var next=market.submit(connected,name,new MarketSubmitRequest(work.toString(),latest.resourceVersion())).block(WAIT);
            assertEquals("PENDING",next.revisions().getLast().status());
            assertEquals("1.0.0",market.get(name).block(WAIT).work().version());
            market.withdraw(connected,name,new MarketVersionRequest(next.resourceVersion())).block(WAIT);
        } finally {
            credentials.disconnect("qa-local-author").block(WAIT);
            assertFalse(credentials.status("qa-local-author").block(WAIT).connected());
            if (name != null) local.delete().uri("/apis/market.lingui.dev/v1alpha1/marketworks/{name}",name)
                .headers(h -> h.setBearerAuth(token)).retrieve().bodyToMono(Void.class).block(WAIT);
        }
    }
}
