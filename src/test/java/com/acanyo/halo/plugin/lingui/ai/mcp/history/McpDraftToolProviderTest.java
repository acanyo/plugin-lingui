package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.acanyo.halo.plugin.lingui.ai.mcp.McpToolExecutor;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import reactor.core.publisher.Mono;
import run.halo.mcpserver.api.McpToolInvocation;

class McpDraftToolProviderTest {
    @Test
    @SuppressWarnings("unchecked")
    void advertisesMutationAndSubmitsOnlyForTheAuthenticatedOwner() {
        var drafts = mock(McpDraftService.class);
        var permissions = mock(McpOwnerPermissions.class);
        var caller = new McpCaller(permissions);
        var activities = mock(McpActivityService.class);
        when(activities.trace(anyString(), anyString(), anyMap(), any()))
            .thenAnswer(call -> ((Supplier<Mono<Map<String, Object>>>) call.getArgument(3)).get());
        when(drafts.submit(eq("alice"), any())).thenReturn(Mono.just(new McpHistoryDtos.DraftInfo(
            "draft-1", "Draft", "", "component", "", null, "now", null)));
        var provider = new McpDraftToolProvider(drafts, caller, new McpToolExecutor(caller, activities));
        var tool = provider.tools().single().block();
        assertThat(tool.name()).isEqualTo("submit_design_draft");
        assertThat(tool.annotations().readOnlyHint()).isFalse();
        assertThat(tool.annotations().destructiveHint()).isFalse();
        assertThat(tool.annotations().idempotentHint()).isTrue();
        var args = Map.<String, Object>of("submissionId", "one", "title", "Draft", "kind", "component", "design", Map.of());
        var result = tool.handler().execute(new McpToolInvocation(tool.name(), args))
            .contextWrite(ReactiveSecurityContextHolder.withAuthentication(
                UsernamePasswordAuthenticationToken.authenticated("alice", null, List.of()))).block();
        assertThat(result.error()).isFalse();
        assertThat(result.structuredContent()).containsEntry("draftId", "draft-1").containsEntry("status", "pending");
        verify(drafts).submit(eq("alice"), argThat(input -> input.path("submissionId").asText().equals("one")));
    }
}
