package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

/** The official MCP server carries the key owner's username in the reactive security context. */
@Component
public class McpCaller {
    private final McpOwnerPermissions permissions;

    public McpCaller(McpOwnerPermissions permissions) {
        this.permissions = permissions;
    }

    public Mono<String> owner() {
        return ReactiveSecurityContextHolder.getContext()
            .mapNotNull(context -> context.getAuthentication())
            .filter(authentication -> authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken))
            .map(authentication -> authentication.getName())
            .filter(name -> !name.isBlank() && !name.equals("anonymousUser"))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN,
                "MCP 调用缺少已认证的 Halo 账号")));
    }

    public Mono<Boolean> canUseTools() {
        return owner().flatMap(owner -> permissions.requireMcp(owner).thenReturn(true))
            .onErrorResume(ResponseStatusException.class, error ->
                error.getStatusCode().value() == 403 ? Mono.just(false) : Mono.error(error));
    }
}
