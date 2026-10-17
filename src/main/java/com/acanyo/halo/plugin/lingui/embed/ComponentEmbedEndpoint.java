package com.acanyo.halo.plugin.lingui.embed;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import org.springdoc.webflux.core.fn.SpringdocRouteBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

@Component
public class ComponentEmbedEndpoint implements CustomEndpoint {
    private final ComponentEmbedService embeds;
    public ComponentEmbedEndpoint(ComponentEmbedService embeds) { this.embeds = embeds; }
    @Override public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1"); }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("componentembeds/{name}", request -> embeds.status(request.pathVariable("name")).flatMap(this::ok),
                op -> op.operationId("GetComponentEmbedStatus").tag("LinguiEmbeds")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().implementation(ComponentEmbedService.EmbedStatus.class)))
            .PUT("componentembeds/{name}", request -> embeds.setEnabled(request.pathVariable("name"), true)
                .flatMap(this::ok).onErrorMap(IllegalArgumentException.class,
                    error -> new ResponseStatusException(HttpStatus.BAD_REQUEST, error.getMessage())),
                op -> op.operationId("EnableComponentEmbed").tag("LinguiEmbeds")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().implementation(ComponentEmbedService.EmbedStatus.class)))
            .DELETE("componentembeds/{name}", request -> embeds.setEnabled(request.pathVariable("name"), false).flatMap(this::ok),
                op -> op.operationId("DisableComponentEmbed").tag("LinguiEmbeds")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true))
                    .response(responseBuilder().implementation(ComponentEmbedService.EmbedStatus.class)))
            .build();
    }
    private Mono<ServerResponse> ok(Object value) {
        return ServerResponse.ok().header("Cache-Control", "no-store").bodyValue(value);
    }
}
