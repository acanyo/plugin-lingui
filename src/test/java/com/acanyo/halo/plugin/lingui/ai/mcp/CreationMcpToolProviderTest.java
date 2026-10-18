package com.acanyo.halo.plugin.lingui.ai.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService;
import com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import com.acanyo.halo.plugin.lingui.ai.tools.SkillResources;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.mcpserver.api.McpToolDefinition;
import run.halo.mcpserver.api.McpToolInvocation;
import run.halo.mcpserver.api.McpToolResult;

class CreationMcpToolProviderTest {
    private final SavedWorkReader works = mock(SavedWorkReader.class);
    private final McpOwnerPermissions permissions = mock(McpOwnerPermissions.class);
    private final McpActivityService activities = mock(McpActivityService.class);
    private final McpCaller caller = new McpCaller(permissions);
    private final CreationMcpToolProvider provider;

    CreationMcpToolProviderTest() throws Exception {
        var tools = new CreationTools(new ComponentCatalog(), new SkillResources(), new DesignValidator());
        provider = new CreationMcpToolProvider(tools, works, permissions, caller, new McpToolExecutor(caller, activities));
    }

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() {
        when(permissions.requireMcp("alice")).thenReturn(Mono.empty());
        when(permissions.requireWork(anyString(), anyString())).thenReturn(Mono.empty());
        when(activities.trace(anyString(), anyString(), anyMap(), any()))
            .thenAnswer(call -> ((Supplier<Mono<Map<String, Object>>>) call.getArgument(3)).get());
    }

    private <T> T asOwner(Mono<T> value) {
        // Official transport authorities are intentionally broad; domain permissions must still be checked.
        var authentication = UsernamePasswordAuthenticationToken.authenticated("alice", null,
            List.of(new SimpleGrantedAuthority("ROLE_super-role")));
        return value.contextWrite(ReactiveSecurityContextHolder.withAuthentication(authentication)).block();
    }

    private McpToolDefinition tool(String name) {
        return provider.tools().filter(tool -> tool.name().equals(name)).single().block();
    }

    private McpToolResult invoke(String name, Map<String, Object> arguments) {
        return asOwner(tool(name).handler().execute(new McpToolInvocation(name, arguments)));
    }

    @Test
    void advertisesLocalToolNamesAndRequiresAnExplicitSavedWork() {
        var definitions = provider.tools().collectList().block();
        assertThat(definitions).extracting(McpToolDefinition::name).containsExactly(
            "search_components", "get_component_schemas", "get_current_work", "get_guidance", "validate_design");
        assertThat(definitions).allSatisfy(tool -> {
            assertThat(tool.inputSchema()).containsEntry("type", "object");
            assertThat(tool.annotations().readOnlyHint()).isTrue();
            assertThat(tool.category()).isEqualTo("创作参考与校验");
        });
        assertThat(tool("get_current_work").inputSchema()).containsEntry("required", List.of("workName"));
        verifyNoInteractions(permissions, works);
    }

    @Test
    void checksRealDomainPermissionEvenWhenTransportGrantsSuperRole() {
        var invocation = new McpToolInvocation("get_current_work", Map.of());
        assertThat(tool("get_current_work").permission().check(invocation).block()).isFalse();
        assertThat(asOwner(tool("get_current_work").permission().check(invocation))).isTrue();
        when(permissions.requireMcp("alice")).thenReturn(Mono.error(
            new ResponseStatusException(HttpStatus.FORBIDDEN)));
        assertThat(asOwner(tool("get_current_work").permission().check(invocation))).isFalse();
        verify(permissions, never()).requireWork(anyString(), anyString());
    }

    @Test
    void readsSkillThroughGuidanceAndReturnsStableArgumentErrors() {
        var skill = invoke("get_guidance", Map.of("topic", "skill"));
        assertThat(skill.error()).isFalse();
        assertThat(skill.structuredContent().get("text")).asString().contains("lingui-create");
        var invalid = invoke("get_guidance", Map.of("topic", "missing"));
        assertThat(invalid.error()).isTrue();
        assertThat(((Map<?, ?>) invalid.structuredContent().get("error")).get("code")).isEqualTo("INVALID_ARGUMENT");
    }

    @Test
    void checksEachRequestedWorkBeforeReadingAndPreservesForbiddenErrors() {
        when(works.read("allowed")).thenReturn(Mono.just(Map.of("workName", "allowed", "revision", 2)));
        var result = invoke("get_current_work", Map.of("workName", "allowed"));
        assertThat(result.error()).isFalse();
        assertThat(result.structuredContent()).containsEntry("revision", 2);
        verify(permissions).requireWork("alice", "allowed");
        when(permissions.requireWork("alice", "private")).thenReturn(Mono.error(
            new ResponseStatusException(HttpStatus.FORBIDDEN, "账号无权读取作品")));
        var forbidden = invoke("get_current_work", Map.of("workName", "private"));
        assertThat(forbidden.error()).isTrue();
        assertThat(((Map<?, ?>) forbidden.structuredContent().get("error")).get("code")).isEqualTo("FORBIDDEN");
        verify(works, never()).read("private");
    }

    @Test
    void mapsMissingSavedWorksToTheOfficialNotFoundError() {
        when(works.read("missing")).thenReturn(Mono.error(
            new ResponseStatusException(HttpStatus.NOT_FOUND, "作品不存在或已删除：missing")));
        var result = invoke("get_current_work", Map.of("workName", "missing"));
        assertThat(result.error()).isTrue();
        assertThat(((Map<?, ?>) result.structuredContent().get("error")).get("code")).isEqualTo("NOT_FOUND");
        verify(permissions).requireWork("alice", "missing");
    }

    @Test
    void missingIdentityCannotReadWorksOrCreateBusinessRecords() {
        var result = tool("get_current_work").handler().execute(new McpToolInvocation(
            "get_current_work", Map.of("workName", "private"))).block();
        assertThat(result.error()).isTrue();
        verifyNoInteractions(works, activities);
    }
}
