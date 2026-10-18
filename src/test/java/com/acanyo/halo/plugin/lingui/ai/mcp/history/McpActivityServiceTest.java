package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.acanyo.halo.plugin.lingui.model.McpActivity;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;

class McpActivityServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final McpActivityService activities = new McpActivityService(client);
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<McpActivity> store = new ArrayList<>();
    @BeforeEach void setup() {
        when(client.create(any(McpActivity.class))).thenAnswer(call -> { McpActivity item = call.getArgument(0); store.add(item); return Mono.just(item); });
        when(client.listAll(eq(McpActivity.class), any(), any())).thenAnswer(call -> Flux.fromIterable(new ArrayList<>(store)));
        when(client.delete(any(McpActivity.class))).thenAnswer(call -> { McpActivity item = call.getArgument(0); store.remove(item); return Mono.just(item); });
    }
    private void call(String name, Map<String, Object> args, Map<String, Object> result) {
        activities.trace("alice", name, args, () -> Mono.just(result)).block();
    }
    @Test void storesSafeActualOperationsAndValidationOutcomesWithoutBodiesOrCredentials() throws Exception {
        call("get_component_schemas", Map.of("names", List.of("Button", "Text", "hmcp_secret")),
            Map.of("components", Map.of("Button", Map.of(), "Text", Map.of())));
        call("get_current_work", Map.of("workName", "weather"), Map.of("isError", false));
        call("validate_design", Map.of("design", Map.of("private", "secret-design"), "token", "hmcp_secret"),
            Map.of("valid", false));
        call("submit_design_draft", Map.of(), Map.of("isError", true, "message", "private-error-body"));
        var list = activities.list("alice").block().items();
        assertThat(list).hasSize(4);
        assertThat(list).extracting(McpHistoryDtos.ActivityInfo::status).contains("success", "needs-fix", "error");
        assertThat(mapper.writeValueAsString(list)).contains("Button", "Text", "weather")
            .doesNotContain("secret-design", "hmcp_secret", "private-error-body");
        assertThat(activities.list("bob").block().items()).isEmpty();
    }
    @Test void boundsActivityRetentionWithoutAffectingOtherOwners() {
        activities.trace("bob", "search_components", Map.of(), () -> Mono.just(Map.of())).block();
        for (int i = 0; i < 302; i++) call("search_components", Map.of(), Map.of());
        assertThat(store).hasSize(301);
        assertThat(activities.list("bob").block().items()).hasSize(1);
        assertThat(activities.list("alice").block().items()).hasSize(300);
    }
    @Test void slowActivityStorageDoesNotSwallowTheSuccessfulBusinessResult() {
        when(client.create(any(McpActivity.class))).thenReturn(Mono.never());
        var result = Map.<String, Object>of("draftId", "created-draft", "status", "pending");
        reactor.test.StepVerifier.withVirtualTime(() -> activities.trace("alice", "submit_design_draft", Map.of(),
            () -> Mono.just(result)))
            .thenAwait(java.time.Duration.ofSeconds(1))
            .expectNext(result).verifyComplete();
    }

}
