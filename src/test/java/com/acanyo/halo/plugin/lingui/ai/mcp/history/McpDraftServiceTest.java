package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.acanyo.halo.plugin.lingui.model.McpDraft;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;

class McpDraftServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final McpOwnerPermissions permissions = mock(McpOwnerPermissions.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, McpDraft> store = new HashMap<>();
    private final McpDraftService drafts = new McpDraftService(client, new DesignValidator(), permissions);
    private McpDraft copy(McpDraft value) { return mapper.convertValue(value, McpDraft.class); }
    @BeforeEach void setup() {
        when(client.listAll(eq(McpDraft.class), any(), any())).thenAnswer(call -> Flux.fromIterable(store.values()).map(this::copy));
        when(client.fetch(eq(McpDraft.class), anyString())).thenAnswer(call -> Mono.justOrEmpty(store.get(call.getArgument(1))).map(this::copy));
        when(client.create(any(McpDraft.class))).thenAnswer(call -> {
            McpDraft draft = call.getArgument(0); store.put(draft.getMetadata().getName(), copy(draft)); return Mono.just(draft);
        });
        when(client.update(any(McpDraft.class))).thenAnswer(call -> {
            McpDraft draft = call.getArgument(0); store.put(draft.getMetadata().getName(), copy(draft)); return Mono.just(draft);
        });
        when(client.delete(any(McpDraft.class))).thenAnswer(call -> {
            McpDraft draft = call.getArgument(0); store.remove(draft.getMetadata().getName()); return Mono.just(draft);
        });
        when(permissions.requireWork(anyString(), anyString())).thenReturn(Mono.empty());
        when(client.fetch(eq(ComponentTemplate.class), anyString())).thenReturn(Mono.empty());
    }
    private ObjectNode input(String id) {
        return mapper.valueToTree(Map.of("submissionId", id, "title", "Draft", "kind", "component", "summary", "调整排版",
            "design", Map.of("document", Map.of("schemaVersion", "lingui.document/2", "title", "Draft", "state", Map.of(),
                "parameters", List.of(), "nodes", List.of(Map.of("id", "root", "component", "Text", "text", "hello"))))));
    }
    @Test void persistsCanonicalImmutableDraftAndIdempotentRetryWithoutSavingProject() {
        var first = drafts.submit("alice", input("one")).block();
        assertThat(drafts.submit("alice", input("one")).block().id()).isEqualTo(first.id());
        assertThat(store).hasSize(1);
        var content = drafts.get("alice", first.id()).block();
        assertThat(content.design()).contains("source").doesNotContain("nodes");
        assertThat(content.draft().loadedAt()).isNull();
        drafts.loaded("alice", first.id()).block();
        assertThat(drafts.get("alice", first.id()).block().design()).isEqualTo(content.design());
        assertThat(drafts.get("alice", first.id()).block().draft().loadedAt()).isNotBlank();
        var changed = input("one"); changed.put("title", "Changed");
        assertThatThrownBy(() -> drafts.submit("alice", changed).block()).hasMessageContaining("submissionId");
        verify(client, never()).create(any(ComponentTemplate.class));
        verify(client, never()).update(any(ComponentTemplate.class));
    }
    @Test void isolatesOwnersForListingReadingMarkingAndDeleting() {
        var draft = drafts.submit("alice", input("one")).block();
        assertThat(drafts.list("bob").block().items()).isEmpty();
        assertThatThrownBy(() -> drafts.get("bob", draft.id()).block()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> drafts.loaded("bob", draft.id()).block()).isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> drafts.delete("bob", draft.id()).block()).isInstanceOf(ResponseStatusException.class);
        drafts.delete("alice", draft.id()).block();
        assertThat(store).isEmpty();
    }
    @Test void rejectsInvalidDesignAndTargetsWithoutCurrentDomainPermission() {
        var broken = input("broken"); broken.set("design", mapper.createObjectNode());
        assertThatThrownBy(() -> drafts.submit("alice", broken).block()).isInstanceOf(IllegalArgumentException.class);
        var target = input("two"); target.put("workName", "other-work").put("baseRevision", 1);
        assertThatThrownBy(() -> drafts.submit("alice", target).block()).hasMessageContaining("不存在");
        target.put("workName", "my-work"); target.remove("baseRevision");
        assertThatThrownBy(() -> drafts.submit("alice", target).block()).hasMessageContaining("baseRevision");
        target.put("baseRevision", 1);
        assertThatThrownBy(() -> drafts.submit("alice", target).block()).hasMessageContaining("不存在");
        when(permissions.requireWork("alice", "my-work")).thenReturn(Mono.error(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN)));
        assertThatThrownBy(() -> drafts.submit("alice", target).block()).isInstanceOf(ResponseStatusException.class);
        assertThat(store).isEmpty();
    }
    @Test void supportsValidatedThemeDraftsAndKeepsEachRevisionAsSeparateSnapshot() throws Exception {
        var valid = mapper.readTree("{\"schemaVersion\":\"lingui.theme/1\",\"id\":\"draft-theme\",\"name\":\"主题\",\"mode\":\"light\",\"font\":\"system\",\"colors\":{\"background\":\"#ffffff\",\"surface\":\"#f5f7fa\",\"text\":\"#172033\",\"muted\":\"#596579\",\"accent\":\"#2563eb\",\"border\":\"#dce2ea\",\"success\":\"#16854b\",\"danger\":\"#dc3545\",\"line\":\"#9ca8b8\"},\"radius\":8,\"spacing\":16,\"iconSize\":20,\"lineWidth\":1,\"shadow\":1}");
        var request = input("theme-1"); request.put("kind", "theme"); request.set("design", valid);
        drafts.submit("alice", request).block();
        request.put("submissionId", "theme-2"); ((ObjectNode) valid).put("radius", 0);
        drafts.submit("alice", request).block();
        assertThat(drafts.list("alice").block().items()).hasSize(2).allMatch(item -> item.kind().equals("theme"));
        request.put("submissionId", "bad-theme"); ((ObjectNode) valid).put("radius", 100);
        assertThatThrownBy(() -> drafts.submit("alice", request).block()).isInstanceOf(IllegalArgumentException.class);
    }
    @Test void acceptsAuthorizedProjectDraftWithoutMutatingItsStoredVersion() {
        var work = new ComponentTemplate(); work.setMetadata(new run.halo.app.extension.Metadata());
        var spec = new ComponentTemplate.TemplateSpec(); spec.setRevision(2); work.setSpec(spec);
        when(client.fetch(ComponentTemplate.class, "my-work")).thenReturn(Mono.just(work));
        var input = input("project-draft"); input.put("workName", "my-work").put("baseRevision", 1);
        var submitted = drafts.submit("alice", input).block();
        assertThat(submitted.baseRevision()).isEqualTo(1);
        assertThat(submitted.workName()).isEqualTo("my-work");
        assertThat(work.getSpec().getRevision()).isEqualTo(2);
        verify(client, never()).update(any(ComponentTemplate.class));
    }
}
