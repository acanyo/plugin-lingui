package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.Map;
import java.util.function.Function;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import reactor.core.publisher.Mono;

/** Shared bounded Streamable HTTP transport, independent of authentication and tool scope. */
public final class McpTransport {
    private final ObjectMapper mapper = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    public Mono<ServerResponse> denied(ServerRequest request) {
        if (!validOrigin(request)) return ServerResponse.status(403).build();
        return ServerResponse.status(405).allow(HttpMethod.POST).build();
    }

    public Mono<ServerResponse> post(ServerRequest request, Function<JsonNode, Mono<Map<String, Object>>> dispatch) {
        if (!validOrigin(request)) return ServerResponse.status(403).build();
        String version = request.headers().firstHeader("MCP-Protocol-Version");
        if (version != null && !McpProtocol.VERSIONS.contains(version)) return ServerResponse.badRequest().build();
        if (request.headers().contentType().filter(MediaType.APPLICATION_JSON::isCompatibleWith).isEmpty())
            return ServerResponse.status(415).build();
        var accept = request.headers().accept();
        if (accept.stream().noneMatch(MediaType.APPLICATION_JSON::isCompatibleWith)
            || accept.stream().noneMatch(MediaType.TEXT_EVENT_STREAM::isCompatibleWith))
            return ServerResponse.status(406).build();
        return DataBufferUtils.join(request.exchange().getRequest().getBody(), 524288)
            .switchIfEmpty(Mono.error(new EmptyBody()))
            .flatMap(buffer -> {
                byte[] bytes = new byte[buffer.readableByteCount()];
                buffer.read(bytes); DataBufferUtils.release(buffer);
                try { return dispatch.apply(mapper.readTree(bytes)); }
                catch (Exception error) { return Mono.just(McpProtocol.error(null, -32700, "Parse error")); }
            })
            .flatMap(result -> ServerResponse.ok().header("Cache-Control", "no-store").contentType(MediaType.APPLICATION_JSON).bodyValue(result))
            .switchIfEmpty(ServerResponse.accepted().header("Cache-Control", "no-store").build())
            .onErrorResume(DataBufferLimitException.class, error -> ServerResponse.status(413).build())
            .onErrorResume(EmptyBody.class, error -> ServerResponse.ok().header("Cache-Control", "no-store").contentType(MediaType.APPLICATION_JSON)
                .bodyValue(McpProtocol.error(null, -32700, "Parse error")));
    }

    private boolean validOrigin(ServerRequest request) {
        String origin = request.headers().firstHeader("Origin");
        if (origin == null) return true;
        try {
            var source = URI.create(origin);
            var target = request.uri();
            return source.getHost() != null && source.getRawUserInfo() == null
                && (source.getRawPath() == null || source.getRawPath().isEmpty())
                && source.getRawQuery() == null && source.getRawFragment() == null
                && source.getScheme().equalsIgnoreCase(target.getScheme())
                && source.getHost().equalsIgnoreCase(target.getHost()) && port(source) == port(target);
        } catch (IllegalArgumentException error) { return false; }
    }

    private int port(URI uri) { return uri.getPort() != -1 ? uri.getPort() : "https".equalsIgnoreCase(uri.getScheme()) ? 443 : 80; }
    private static final class EmptyBody extends RuntimeException {}

}
