package com.acanyo.halo.plugin.lingui.embed;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

@Component
public class PublicComponentEmbedEndpoint implements CustomEndpoint {
    private final ComponentEmbedService embeds;
    public PublicComponentEmbedEndpoint(ComponentEmbedService embeds) { this.embeds = embeds; }
    @Override public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("api.lingui.acanyo.com/v1alpha1"); }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return RouterFunctions.route().GET("componentembeds/{name}", request ->
            embeds.read(request.pathVariable("name")).flatMap(value ->
                ServerResponse.ok().header("Cache-Control", "no-store").contentType(MediaType.APPLICATION_JSON).bodyValue(value.toString()))
                .onErrorResume(ResponseStatusException.class, error -> ServerResponse.status(error.getStatusCode())
                    .header("Cache-Control", "no-store").contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(java.util.Map.of("message", error.getReason() == null ? "组件暂时无法加载" : error.getReason()))))
            .build();
    }
}
