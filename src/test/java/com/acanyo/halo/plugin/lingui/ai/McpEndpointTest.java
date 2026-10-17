package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.mcp.*;
import com.acanyo.halo.plugin.lingui.ai.tools.*;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import static org.mockito.Mockito.*;

class McpEndpointTest {
    private final SavedWorkReader works = mock(SavedWorkReader.class);
    private final WebTestClient client;
    McpEndpointTest() throws Exception {
        var resources = new SkillResources();
        var tools = new CreationTools(new ComponentCatalog(), resources, new DesignValidator());
        client = WebTestClient.bindToRouterFunction(new McpEndpoint(new McpProtocol(tools, resources, works)).endpoint()).build();
    }
    private WebTestClient.ResponseSpec post(Object body) {
        return client.post().uri("/mcp").contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM).bodyValue(body).exchange();
    }
    private Map<String,Object> request(String method, Object params) {
        return Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params);
    }

    @Test void negotiatesProtocolAndExposesRealToolsAndSkill() {
        post(request("initialize", Map.of("protocolVersion", "future", "capabilities", Map.of(),
            "clientInfo", Map.of("name", "test", "version", "1"))))
            .expectStatus().isOk().expectBody().jsonPath("$.result.protocolVersion").isEqualTo(McpProtocol.VERSION);
        post(request("tools/list", Map.of())).expectStatus().isOk().expectBody().jsonPath("$.result.tools.length()").isEqualTo(5);
        post(request("resources/read", Map.of("uri", McpProtocol.SKILL_URI)))
            .expectStatus().isOk().expectBody().jsonPath("$.result.contents[0].mimeType").isEqualTo("text/markdown");
        post(request("tools/call", Map.of("name", "get_component_schemas", "arguments", Map.of("names", new String[]{"Button"}))))
            .expectStatus().isOk().expectBody().jsonPath("$.result.structuredContent.components.Button").exists();
    }

    @Test void requiresExplicitExternalWorkAndNeverReadsAnotherRequestsContext() {
        post(request("tools/call", Map.of("name", "get_current_work"))).expectStatus().isOk()
            .expectBody().jsonPath("$.result.isError").isEqualTo(true);
        verifyNoInteractions(works);
        when(works.read("my-work")).thenReturn(Mono.just(Map.of("document", Map.of("title", "Mine"))));
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "my-work"))))
            .expectStatus().isOk().expectBody().jsonPath("$.result.structuredContent.document.title").isEqualTo("Mine");
        verify(works).read("my-work");
    }

    @Test void handlesNotificationsAndProtocolErrors() {
        post(Map.of("jsonrpc", "2.0", "method", "notifications/initialized"))
            .expectStatus().isAccepted().expectBody().isEmpty();
        post("{").expectStatus().isOk().expectBody().jsonPath("$.error.code").isEqualTo(-32700);
        post(new Object[]{request("ping", Map.of())}).expectBody().jsonPath("$.error.code").isEqualTo(-32600);
        post(request("executeJavascript", Map.of())).expectBody().jsonPath("$.error.code").isEqualTo(-32601);
        post(request("tools/call", Map.of("name", "get_guidance", "arguments", Map.of("topic", "bad"))))
            .expectBody().jsonPath("$.result.isError").isEqualTo(true);
    }

    @Test void returnsImportableSourceForValidExternalDesignsOnly() {
        var design = Map.of("document", Map.of("schemaVersion", "lingui.document/2", "title", "外部作品",
            "parameters", java.util.List.of(), "state", Map.of(),
            "nodes", java.util.List.of(Map.of("id", "root", "component", "Text", "text", "你好"))));
        post(request("tools/call", Map.of("name", "validate_design",
            "arguments", Map.of("design", design, "finalize", true))))
            .expectStatus().isOk().expectBody()
            .jsonPath("$.result.structuredContent.valid").isEqualTo(true)
            .jsonPath("$.result.structuredContent.design.document.source").value(
                source -> org.assertj.core.api.Assertions.assertThat(source.toString()).contains("root = Text("))
            .jsonPath("$.result.structuredContent.design.document.nodes").doesNotExist();
        post(request("tools/call", Map.of("name", "validate_design",
            "arguments", Map.of("design", Map.of("document", Map.of())))))
            .expectStatus().isOk().expectBody()
            .jsonPath("$.result.structuredContent.valid").isEqualTo(false)
            .jsonPath("$.result.structuredContent.design").doesNotExist();
        verifyNoInteractions(works);
    }

    @Test void checksTransportOriginAcceptAndProtocolVersion() {
        client.post().uri("http://localhost/mcp").header("Origin", "https://evil.example")
            .contentType(MediaType.APPLICATION_JSON).bodyValue(request("ping", Map.of())).exchange().expectStatus().isForbidden();
        client.post().uri("/mcp").header("MCP-Protocol-Version", "bad").exchange().expectStatus().isBadRequest();
        client.post().uri("/mcp").contentType(MediaType.APPLICATION_JSON)
            .accept(MediaType.APPLICATION_JSON).bodyValue(request("ping", Map.of())).exchange().expectStatus().isEqualTo(406);
        client.get().uri("/mcp").exchange().expectStatus().isEqualTo(405);
    }
}
