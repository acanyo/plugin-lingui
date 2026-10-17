package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import com.acanyo.halo.plugin.lingui.ai.mcp.McpProtocol;
import com.acanyo.halo.plugin.lingui.ai.mcp.McpTransport;
import com.acanyo.halo.plugin.lingui.ai.mcp.SavedWorkReader;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftService;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

/** Publicly reachable transport, exclusively authenticated by a dedicated Lingui MCP key. */
@Component
public class PublicMcpEndpoint implements CustomEndpoint {
    private final McpKeyService keys;
    private final McpOwnerPermissions permissions;
    private final SavedWorkReader works;
    private final McpProtocol protocol;
    private final McpDraftService drafts;
    private final McpActivityService activities;
    private final McpTransport transport = new McpTransport();
    public PublicMcpEndpoint(McpKeyService keys, McpOwnerPermissions permissions,
        SavedWorkReader works, McpProtocol protocol, McpDraftService drafts, McpActivityService activities) {
        this.keys = keys; this.permissions = permissions; this.works = works; this.protocol = protocol;
        this.drafts = drafts; this.activities = activities;
    }
    @Override public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("api.lingui.acanyo.com/v1alpha1");
    }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return RouterFunctions.route().POST("mcp", this::handle)
            .GET("mcp", this::handle).DELETE("mcp", this::handle).build();
    }
    private Mono<ServerResponse> handle(ServerRequest request) {
        // Authenticate even notifications and malformed bodies, before any protocol work.
        return keys.authenticate(request.headers().firstHeader("X-Lingui-MCP-Key")).flatMap(grant -> {
            if (request.method() != org.springframework.http.HttpMethod.POST) return transport.denied(request);
            return transport.post(request, message -> activities.trace(grant, message, () -> protocol.handle(message, name -> {
                if (!grant.allows(name)) return Mono.error(new IllegalArgumentException("此密钥未授权读取该项目"));
                return permissions.requireWork(grant.owner(), name)
                    .onErrorMap(ResponseStatusException.class, error -> new IllegalArgumentException("账号已无权读取该项目"))
                    .then(Mono.defer(() -> works.read(name)));
            }, grant.canReadWorks(), grant.submitDrafts() ? input -> drafts.submit(grant, input)
                .map(draft -> (Object) Map.of("draftId", draft.id(), "title", draft.title(), "status", "pending",
                    "message", "草稿已提交。请在灵构工作台的「外部 AI 草稿」中预览与载入，确认后再保存项目。"))
                .onErrorResume(ResponseStatusException.class, error -> Mono.just(Map.of("isError", true, "message", error.getReason() == null ? "草稿提交被拒绝" : error.getReason())))
                .onErrorResume(IllegalArgumentException.class, error -> Mono.just(Map.of("isError", true, "message", error.getMessage()))) : null)));
        }).onErrorResume(ResponseStatusException.class, error -> {
            var response = ServerResponse.status(error.getStatusCode()).header("Cache-Control", "no-store");
            if (error.getStatusCode().value() == 401)
                response.header(HttpHeaders.WWW_AUTHENTICATE, "LinguiKey realm=\"Lingui MCP\"");
            return response.contentType(MediaType.APPLICATION_JSON)
                .bodyValue(Map.of("message", error.getReason() == null ? "MCP 访问被拒绝" : error.getReason()));
        });
    }
}
