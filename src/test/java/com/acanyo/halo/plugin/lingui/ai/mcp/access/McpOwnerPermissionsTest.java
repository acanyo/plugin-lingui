package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.Role;
import run.halo.app.core.extension.User;
import run.halo.app.core.user.service.RoleService;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class McpOwnerPermissionsTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final RoleService roles = mock(RoleService.class);
    private final McpOwnerPermissions permissions = new McpOwnerPermissions(client, roles);
    private final User user = new User();
    @BeforeEach void setup() {
        user.setMetadata(new Metadata()); user.getMetadata().setName("alice"); user.setSpec(new User.UserSpec());
        when(client.fetch(User.class, "alice")).thenReturn(Mono.just(user));
        when(roles.getRolesByUsername("alice")).thenReturn(Flux.just("writer"));
        when(roles.listDependenciesFlux(anySet())).thenReturn(Flux.empty());
    }
    private void rules(Role.PolicyRule... rules) {
        var role = new Role(); role.setMetadata(new Metadata()); role.getMetadata().setName("writer"); role.setRules(List.of(rules));
        when(roles.listDependenciesFlux(anySet())).thenReturn(Flux.just(role));
    }
    private void denied(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            error -> assertThat(error.getStatusCode().value()).isEqualTo(403));
    }
    @Test void respectsExactGroupsVerbsAndProjectResourceNames() {
        rules(new Role.PolicyRule(new String[]{"lingui.acanyo.com"}, new String[]{"componenttemplates"}, new String[]{"one"}, null, new String[]{"get"}));
        permissions.requireWork("alice", "one").block();
        denied(() -> permissions.requireWork("alice", "two").block());
        denied(() -> permissions.requireMcp("alice").block());
        rules(new Role.PolicyRule(new String[]{"console.api.lingui.acanyo.com"}, new String[]{"mcp"}, null, null, new String[]{"create"}));
        permissions.requireMcp("alice").block();
        denied(() -> permissions.requireWork("alice", "one").block());
    }
    @Test void accountRevocationWinsEvenForSuperAdminAndMissingRolesFailClosed() {
        denied(() -> permissions.requireMcp("alice").block());
        when(roles.getRolesByUsername("alice")).thenReturn(Flux.just("super-role"));
        permissions.requireMcp("alice").block();
        user.getSpec().setDisabled(true);
        denied(() -> permissions.requireMcp("alice").block());
        user.getSpec().setDisabled(false); user.getMetadata().setDeletionTimestamp(Instant.now());
        denied(() -> permissions.requireMcp("alice").block());
        when(client.fetch(User.class, "alice")).thenReturn(Mono.empty());
        denied(() -> permissions.requireMcp("alice").block());
    }
}
