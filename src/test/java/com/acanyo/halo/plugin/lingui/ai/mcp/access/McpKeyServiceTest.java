package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static com.acanyo.halo.plugin.lingui.ai.mcp.access.McpKeyDtos.*;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Secret;

class McpKeyServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final McpOwnerPermissions permissions = mock(McpOwnerPermissions.class);
    private final Map<String, Secret> store = new HashMap<>();
    private final McpKeyService service = new McpKeyService(client, permissions);
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
    private Secret copy(Secret secret) { return mapper.convertValue(secret, Secret.class); }
    @BeforeEach void setup() {
        when(permissions.requireMcp(anyString())).thenReturn(Mono.empty());
        when(permissions.requireWork(anyString(), anyString())).thenReturn(Mono.empty());
        when(client.listAll(eq(Secret.class), any(), any())).thenAnswer(call -> Flux.fromIterable(store.values()).map(this::copy));
        when(client.fetch(eq(Secret.class), anyString())).thenAnswer(call -> Mono.justOrEmpty(store.get(call.getArgument(1))).map(this::copy));
        when(client.create(any(Secret.class))).thenAnswer(call -> {
            Secret secret = call.getArgument(0); store.put(secret.getMetadata().getName(), copy(secret)); return Mono.just(secret);
        });
        when(client.update(any(Secret.class))).thenAnswer(call -> {
            Secret secret = call.getArgument(0); store.put(secret.getMetadata().getName(), copy(secret)); return Mono.just(secret);
        });
        when(client.delete(any(Secret.class))).thenAnswer(call -> {
            Secret secret = call.getArgument(0); store.remove(secret.getMetadata().getName()); return Mono.just(secret);
        });
    }
    private IssuedMcpKey issue(String owner, List<String> works) {
        return service.create(owner, new CreateMcpKeyRequest("Test AI", 30, works, false)).block();
    }
    private static void status(Runnable call, int code) {
        assertThatThrownBy(call::run).isInstanceOfSatisfying(ResponseStatusException.class,
            error -> assertThat(error.getStatusCode().value()).isEqualTo(code));
    }
    @Test void issuesRandomDedicatedKeysAndNeverPersistsOrListsPlaintext() throws Exception {
        var first = issue("alice", List.of()); var second = issue("alice", List.of());
        assertThat(first.token()).matches("lgu_mcp_[a-f0-9]{32}\\.[A-Za-z0-9_-]{43}").isNotEqualTo(second.token());
        assertThat(mapper.writeValueAsString(store)).doesNotContain(first.token(), second.token());
        assertThat(mapper.writeValueAsString(service.list("alice").block())).doesNotContain(first.token(), "hash", "token");
        assertThat(service.authenticate(first.token()).block().workNames()).isEmpty();
    }
    @Test void isolatesOwnersAndRequiresRevocationBeforeDeleting() {
        var first = issue("alice", List.of("only-work")); issue("bob", List.of());
        assertThat(service.list("alice").block().items()).hasSize(1);
        status(() -> service.revoke("bob", first.key().id()).block(), 404);
        status(() -> service.delete("bob", first.key().id()).block(), 404);
        status(() -> service.delete("alice", first.key().id()).block(), 400);
        service.revoke("alice", first.key().id()).block();
        assertThat(service.list("alice").block().items().getFirst().revoked()).isTrue();
        status(() -> service.authenticate(first.token()).block(), 401);
        service.delete("alice", first.key().id()).block();
        assertThat(service.list("alice").block().items()).isEmpty();
        status(() -> service.authenticate(first.token()).block(), 401);
    }
    @Test void rejectsUnknownWrongExpiredAndHaloCredentials() {
        var issued = issue("alice", List.of());
        for (String value : List.of("", "Bearer halo_pat_example", "Basic abc", issued.token() + "x",
            issued.token().substring(0, 41) + "x".repeat(43)))
            status(() -> service.authenticate(value).block(), 401);
        status(() -> service.authenticate(null).block(), 401);
        var secret = store.values().iterator().next();
        secret.getStringData().put("expiresAt", Instant.now().minusSeconds(1).toString());
        status(() -> service.authenticate(issued.token()).block(), 401);
    }
    @Test void rechecksOwnerPermissionsAndLimitsWorkGrantToExactNames() {
        var issued = issue("alice", List.of("work-1", "work-1"));
        var grant = service.authenticate(issued.token()).block();
        assertThat(grant.workNames()).containsExactly("work-1");
        assertThat(grant.allows("work-2")).isFalse();
        when(permissions.requireMcp("alice")).thenReturn(Mono.error(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN)));
        status(() -> service.authenticate(issued.token()).block(), 403);
    }
    @Test void persistsExplicitAllProjectScopeWithoutSnapshottingNames() {
        var issued = service.create("alice", new CreateMcpKeyRequest("All projects", 30, List.of(), true)).block();
        assertThat(issued.key().allWorks()).isTrue();
        assertThat(issued.key().workNames()).isEmpty();
        assertThat(service.list("alice").block().items().getFirst().allWorks()).isTrue();
        var grant = service.authenticate(issued.token()).block();
        assertThat(grant.canReadWorks()).isTrue();
        assertThat(grant.allows("existing-project")).isTrue();
        assertThat(grant.allows("created-after-key")).isTrue();
        verify(permissions, never()).requireWork(anyString(), anyString());
        service.revoke("alice", issued.key().id()).block();
        status(() -> service.authenticate(issued.token()).block(), 401);
    }
    @Test void missingOrMalformedAllProjectFlagNeverBroadensExistingKeys() {
        var issued = service.create("alice", new CreateMcpKeyRequest("Old client", 30, List.of("work-1"), null)).block();
        var secret = store.values().iterator().next();
        for (String flag : List.of("", "TRUE", "invalid")) {
            if (flag.isEmpty()) secret.getStringData().remove("allWorks");
            else secret.getStringData().put("allWorks", flag);
            assertThat(service.list("alice").block().items().getFirst().allWorks()).isFalse();
            var grant = service.authenticate(issued.token()).block();
            assertThat(grant.allows("work-1")).isTrue();
            assertThat(grant.allows("other-work")).isFalse();
            secret = store.values().iterator().next();
        }
    }
    @Test void rejectsConflictingProjectScopesBeforePersistence() {
        status(() -> service.create("alice", new CreateMcpKeyRequest("Conflicting", 30, List.of("work-1"), true)).block(), 400);
        assertThat(store).isEmpty();
        var noProjects = issue("alice", List.of());
        assertThat(service.authenticate(noProjects.token()).block().canReadWorks()).isFalse();
    }
    @Test void validatesGrantBeforePersistingAndNeverRetriesStaleUsageWrites() {
        when(permissions.requireWork("alice", "secret-work")).thenReturn(Mono.error(new ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN)));
        status(() -> issue("alice", List.of("secret-work")), 403);
        assertThat(store).isEmpty();
        var issued = issue("alice", List.of());
        when(client.update(any(Secret.class))).thenAnswer(call -> {
            var stored = store.values().iterator().next(); stored.getStringData().remove("hash");
            stored.getStringData().put("revokedAt", Instant.now().toString());
            return Mono.error(new IllegalStateException("version conflict"));
        });
        service.authenticate(issued.token()).block();
        status(() -> service.authenticate(issued.token()).block(), 401);
        verify(client, times(1)).update(any(Secret.class));
    }
    @Test void draftSubmissionIsExplicitAndMissingFlagNeverEnablesIt() {
        var readOnly = issue("alice", List.of());
        assertThat(service.authenticate(readOnly.token()).block().submitDrafts()).isFalse();
        var issued = service.create("alice", new CreateMcpKeyRequest("Writer", 30, List.of(), false, true)).block();
        assertThat(issued.key().submitDrafts()).isTrue();
        var grant = service.authenticate(issued.token()).block();
        assertThat(grant.submitDrafts()).isTrue();
        assertThat(grant.keyId()).isEqualTo(issued.key().id());
        assertThat(grant.canReadWorks()).isFalse();
        var secret = store.get("lingui-mcp-" + issued.key().id());
        secret.getStringData().remove("submitDrafts");
        assertThat(service.authenticate(issued.token()).block().submitDrafts()).isFalse();
    }
}
