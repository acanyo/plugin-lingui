package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.User;
import run.halo.app.core.extension.Role;
import run.halo.app.core.user.service.RoleService;
import run.halo.app.extension.ReactiveExtensionClient;

/** Check the real Halo account and role bindings, never the MCP transport authorities. */
@Component
public class McpOwnerPermissions {
    private final ReactiveExtensionClient client;
    private final RoleService roles;
    public McpOwnerPermissions(ReactiveExtensionClient client, RoleService roles) {
        this.client = client; this.roles = roles;
    }
    public Mono<Void> requireMcp(String owner) {
        return require(owner, "console.api.lingui.acanyo.com", "mcp", "create", null);
    }
    public Mono<Void> requireWork(String owner, String workName) {
        return require(owner, "lingui.acanyo.com", "componenttemplates", "get", workName);
    }
    private Mono<Void> require(String owner, String group, String resource, String verb, String name) {
        return client.fetch(User.class, owner)
            .filter(user -> user.getMetadata().getDeletionTimestamp() == null && user.getSpec() != null
                && !Boolean.TRUE.equals(user.getSpec().getDisabled()))
            .switchIfEmpty(Mono.error(denied()))
            .flatMap(user -> roles.getRolesByUsername(owner).collectList())
            .flatMap(names -> {
                if (names.contains("super-role")) return Mono.just(true);
                Set<String> effective = new HashSet<>(names);
                effective.add("authenticated");
                return roles.listDependenciesFlux(effective)
                    .filter(role -> role.getMetadata().getDeletionTimestamp() == null && role.getRules() != null)
                    .any(role -> role.getRules().stream().anyMatch(rule -> allows(rule, group, resource, verb, name)));
            }).filter(Boolean::booleanValue).switchIfEmpty(Mono.error(denied())).then();
    }
    private static boolean allows(Role.PolicyRule rule, String group, String resource, String verb, String name) {
        return contains(rule.getApiGroups(), group) && contains(rule.getResources(), resource)
            && contains(rule.getVerbs(), verb)
            && ((rule.getResourceNames() == null || rule.getResourceNames().length == 0) || name != null && Arrays.asList(rule.getResourceNames()).contains(name));
    }
    private static boolean contains(String[] values, String value) {
        return values != null && (Arrays.asList(values).contains(value) || Arrays.asList(values).contains("*"));
    }
    private static ResponseStatusException denied() {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, "MCP 所属账号已停用、删除或没有所需权限");
    }
}
