package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import com.acanyo.halo.plugin.lingui.ai.mcp.*;
import com.acanyo.halo.plugin.lingui.ai.tools.*;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

class PublicMcpEndpointTest {
    private final McpKeyService keys = mock(McpKeyService.class);
    private final McpOwnerPermissions permissions = mock(McpOwnerPermissions.class);
    private final SavedWorkReader works = mock(SavedWorkReader.class);
    private final com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftService drafts = mock(com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftService.class);
    private final com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService activities = mock(com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService.class);
    private final WebTestClient client;
    PublicMcpEndpointTest() throws Exception {
        var resources = new SkillResources();
        var tools = new CreationTools(new ComponentCatalog(), resources, new DesignValidator());
        client = WebTestClient.bindToRouterFunction(new PublicMcpEndpoint(keys, permissions, works,
            new McpProtocol(tools, resources, works), drafts, activities).endpoint()).build();
        when(activities.trace(any(), any(), any())).thenAnswer(call -> ((java.util.function.Supplier<?>) call.getArgument(2)).get());
        when(keys.authenticate(any())).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid key")));
        when(keys.authenticate(isNull())).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid key")));
        when(permissions.requireWork(anyString(), anyString())).thenReturn(Mono.empty());
    }
    private void grant(List<String> works) { when(keys.authenticate("test-key")).thenReturn(Mono.just(new McpKeyService.Grant("alice", works, false))); }
    private WebTestClient.ResponseSpec post(Object body) {
        return client.post().uri("/mcp").header("X-Lingui-MCP-Key", "test-key")
            .contentType(MediaType.APPLICATION_JSON).accept(MediaType.APPLICATION_JSON, MediaType.TEXT_EVENT_STREAM)
            .bodyValue(body).exchange();
    }
    private Map<String, Object> request(String method, Object params) {
        return Map.of("jsonrpc", "2.0", "id", 1, "method", method, "params", params);
    }
    @Test void authenticatesBeforeParsingNotificationsAndOtherMethods() {
        client.post().uri("/mcp?key=test-key").cookie("SESSION", "logged-in-session").bodyValue("{").exchange()
            .expectStatus().isUnauthorized().expectHeader().valueEquals("Cache-Control", "no-store");
        post(Map.of("jsonrpc", "2.0", "method", "notifications/initialized")).expectStatus().isUnauthorized();
        client.get().uri("/mcp").exchange().expectStatus().isUnauthorized();
        verifyNoInteractions(works);
    }
    @Test void emptyGrantHidesWorkToolAndRejectsDirectCall() {
        grant(List.of());
        post(request("tools/list", Map.of())).expectStatus().isOk().expectBody()
            .jsonPath("$.result.tools.length()").isEqualTo(4);
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "secret-work"))))
            .expectStatus().isOk().expectBody().jsonPath("$.error.code").isEqualTo(-32003);
        post(request("resources/read", Map.of("uri", McpProtocol.SKILL_URI))).expectStatus().isOk();
        verifyNoInteractions(works);
    }
    @Test void readsOnlyExplicitGrantWithCurrentOwnerPermissions() {
        grant(List.of("work-1"));
        when(works.read("work-1")).thenReturn(Mono.just(Map.of("title", "Allowed")));
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "work-2"))))
            .expectBody().jsonPath("$.result.isError").isEqualTo(true);
        verifyNoInteractions(works);
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "work-1"))))
            .expectBody().jsonPath("$.result.structuredContent.title").isEqualTo("Allowed");
        verify(works, times(1)).read("work-1");
        when(permissions.requireWork("alice", "work-1")).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN)));
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "work-1"))))
            .expectBody().jsonPath("$.result.isError").isEqualTo(true);
        verifyNoMoreInteractions(works);
    }
    @Test void retainsTransportLimitsAndOriginChecksAfterAuthentication() {
        grant(List.of());
        client.post().uri("/mcp").header("X-Lingui-MCP-Key", "test-key").header("Origin", "https://evil.test")
            .exchange().expectStatus().isForbidden();
        post("x".repeat(524289)).expectStatus().isEqualTo(413);
        post("{\"jsonrpc\":\"2.0\",\"id\":1,\"id\":2,\"method\":\"ping\"}")
            .expectBody().jsonPath("$.error.code").isEqualTo(-32700);
        verifyNoInteractions(works);
    }
    @Test void allProjectGrantReadsFutureProjectsButStillChecksCurrentOwnerPermissions() {
        when(keys.authenticate("test-key")).thenReturn(Mono.just(new McpKeyService.Grant("alice", List.of(), true)));
        when(works.read("future-work")).thenReturn(Mono.just(Map.of("title", "New project")));
        post(request("tools/list", Map.of())).expectStatus().isOk().expectBody()
            .jsonPath("$.result.tools.length()").isEqualTo(5);
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "future-work"))))
            .expectBody().jsonPath("$.result.structuredContent.title").isEqualTo("New project");
        verify(permissions).requireWork("alice", "future-work");
        when(permissions.requireWork("alice", "restricted-work")).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.FORBIDDEN)));
        post(request("tools/call", Map.of("name", "get_current_work", "arguments", Map.of("workName", "restricted-work"))))
            .expectBody().jsonPath("$.result.isError").isEqualTo(true);
        verify(works, never()).read("restricted-work");
        verify(works, times(1)).read("future-work");
    }

    @Test void draftToolIsHiddenAndDirectCallsDeniedWithoutSeparateGrant() {
        grant(List.of("work-1"));
        post(request("tools/list", Map.of())).expectBody().jsonPath("$.result.tools.length()").isEqualTo(5);
        post(request("tools/call", Map.of("name", "submit_design_draft", "arguments", Map.of())))
            .expectBody().jsonPath("$.error.code").isEqualTo(-32003);
        verifyNoInteractions(drafts);
    }

    @Test void authorizedDraftSubmissionReturnsPendingSnapshotAndExposesMutationAnnotation() {
        var grant = new McpKeyService.Grant("alice", List.of(), false, true, "key-1", "My AI");
        when(keys.authenticate("test-key")).thenReturn(Mono.just(grant));
        when(drafts.submit(eq(grant), any())).thenReturn(Mono.just(new com.acanyo.halo.plugin.lingui.ai.mcp.history.McpHistoryDtos.DraftInfo(
            "draft-1", "Test", "", "component", "", null, "My AI", "now", null)));
        post(request("tools/list", Map.of())).expectBody().jsonPath("$.result.tools[4].name").isEqualTo("submit_design_draft")
            .jsonPath("$.result.tools[4].annotations.readOnlyHint").isEqualTo(false);
        post(request("tools/call", Map.of("name", "submit_design_draft", "arguments", Map.of())))
            .expectBody().jsonPath("$.result.structuredContent.status").isEqualTo("pending")
            .jsonPath("$.result.structuredContent.draftId").isEqualTo("draft-1");
        verifyNoInteractions(works);
    }
}
