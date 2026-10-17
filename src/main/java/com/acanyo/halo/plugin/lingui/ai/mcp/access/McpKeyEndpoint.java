package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static com.acanyo.halo.plugin.lingui.ai.mcp.access.McpKeyDtos.*;
import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import static org.springdoc.core.fn.builders.requestbody.Builder.requestBodyBuilder;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import org.springdoc.webflux.core.fn.SpringdocRouteBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

/** Browser management is still protected by Halo login and MCP RBAC; all operations are owner scoped. */
@Component
public class McpKeyEndpoint implements CustomEndpoint {
    private final McpKeyService keys;
    public McpKeyEndpoint(McpKeyService keys) { this.keys = keys; }
    @Override public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1"); }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("mcpkeys", request -> actor(request).flatMap(keys::list).flatMap(this::ok),
                op -> op.operationId("ListMcpKeys").tag("LinguiMcpKeys").response(responseBuilder().implementation(McpKeyList.class)))
            .POST("mcpkeys", request -> actor(request).flatMap(owner -> request.bodyToMono(CreateMcpKeyRequest.class)
                .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "密钥配置不能为空")))
                .flatMap(input -> keys.create(owner, input))).flatMap(this::ok),
                op -> op.operationId("CreateMcpKey").tag("LinguiMcpKeys")
                    .requestBody(requestBodyBuilder().implementation(CreateMcpKeyRequest.class))
                    .response(responseBuilder().implementation(IssuedMcpKey.class)))
            .DELETE("mcpkeys/{name}", request -> actor(request).flatMap(owner -> keys.delete(owner, request.pathVariable("name")))
                .then(ServerResponse.noContent().header("Cache-Control", "no-store").build()),
                op -> op.operationId("DeleteMcpKey").tag("LinguiMcpKeys").parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().responseCode("204")))
            .PUT("mcpkeys/{name}/revoke", request -> actor(request).flatMap(owner -> keys.revoke(owner, request.pathVariable("name")))
                .then(ServerResponse.noContent().header("Cache-Control", "no-store").build()),
                op -> op.operationId("RevokeMcpKey").tag("LinguiMcpKeys").parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().responseCode("204"))).build();
    }
    private Mono<ServerResponse> ok(Object value) { return ServerResponse.ok().header("Cache-Control", "no-store").bodyValue(value); }
    private static Mono<String> actor(ServerRequest request) {
        return request.principal().map(java.security.Principal::getName).filter(name -> !name.equals("anonymousUser"))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请登录 Halo 管理 MCP 接入密钥")));
    }
}
