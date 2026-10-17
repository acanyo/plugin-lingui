package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static com.acanyo.halo.plugin.lingui.ai.mcp.history.McpHistoryDtos.*;
import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import org.springdoc.webflux.core.fn.SpringdocRouteBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.*;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

@Component
public class McpHistoryEndpoint implements CustomEndpoint {
    private final McpDraftService drafts;
    private final McpActivityService activities;
    public McpHistoryEndpoint(McpDraftService drafts, McpActivityService activities) { this.drafts = drafts; this.activities = activities; }
    @Override public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1"); }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("mcpdrafts", request -> actor(request).flatMap(drafts::list).flatMap(this::ok),
                op -> op.operationId("ListMcpDrafts").tag("LinguiMcpHistory").response(responseBuilder().implementation(DraftList.class)))
            .GET("mcpdrafts/{name}", request -> actor(request).flatMap(owner -> drafts.get(owner, request.pathVariable("name"))).flatMap(this::ok),
                op -> op.operationId("GetMcpDraft").tag("LinguiMcpHistory")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().implementation(DraftDetail.class)))
            .PUT("mcpdrafts/{name}/loaded", request -> actor(request).flatMap(owner -> drafts.loaded(owner, request.pathVariable("name"))).then(noContent()),
                op -> op.operationId("MarkMcpDraftLoaded").tag("LinguiMcpHistory")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().responseCode("204")))
            .DELETE("mcpdrafts/{name}", request -> actor(request).flatMap(owner -> drafts.delete(owner, request.pathVariable("name"))).then(noContent()),
                op -> op.operationId("DeleteMcpDraft").tag("LinguiMcpHistory")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().responseCode("204")))
            .GET("mcpactivities", request -> actor(request).flatMap(activities::list).flatMap(this::ok),
                op -> op.operationId("ListMcpActivities").tag("LinguiMcpHistory").response(responseBuilder().implementation(ActivityList.class))).build();
    }
    private Mono<ServerResponse> ok(Object value) { return ServerResponse.ok().header("Cache-Control", "no-store").bodyValue(value); }
    private Mono<ServerResponse> noContent() { return ServerResponse.noContent().header("Cache-Control", "no-store").build(); }
    private static Mono<String> actor(ServerRequest request) {
        return request.principal().map(java.security.Principal::getName).filter(name -> !name.equals("anonymousUser"))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请登录 Halo 查看外部 AI 草稿与记录")));
    }
}
