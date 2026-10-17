package com.acanyo.halo.plugin.lingui.ai.mcp;

import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

/** In-console diagnostics use Halo login and MCP RBAC. External clients use PublicMcpEndpoint. */
@Component
public class McpEndpoint implements CustomEndpoint {
    private final McpProtocol protocol;
    private final McpTransport transport = new McpTransport();
    public McpEndpoint(McpProtocol protocol) { this.protocol = protocol; }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return RouterFunctions.route().POST("mcp", request -> transport.post(request, protocol::handle))
            .GET("mcp", transport::denied).DELETE("mcp", transport::denied).build();
    }
    @Override public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1");
    }
}
