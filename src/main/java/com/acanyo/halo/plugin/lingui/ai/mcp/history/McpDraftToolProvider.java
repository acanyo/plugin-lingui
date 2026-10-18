package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import com.acanyo.halo.plugin.lingui.ai.mcp.McpToolExecutor;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;
import run.halo.mcpserver.api.McpToolAnnotations;
import run.halo.mcpserver.api.McpToolDefinition;
import run.halo.mcpserver.api.McpToolProvider;

/** Submit immutable review snapshots; this tool never saves or publishes a project. */
public final class McpDraftToolProvider implements McpToolProvider {
    private final McpDraftService drafts;
    private final McpCaller caller;
    private final McpToolExecutor executor;
    private final ObjectMapper mapper = new ObjectMapper();

    public McpDraftToolProvider(McpDraftService drafts, McpCaller caller, McpToolExecutor executor) {
        this.drafts = drafts;
        this.caller = caller;
        this.executor = executor;
    }

    @Override
    public Flux<McpToolDefinition> tools() {
        return Flux.just(McpToolDefinition.builder().name("submit_design_draft")
            .title("Submit design draft").displayTitle("提交待确认草稿").category("外部 AI 草稿")
            .description("提交完整组件或主题草稿到工作台，供用户预览、对比和确认；不保存项目或发布。修改已有项目必须提供 workName 和 get_current_work 返回的 revision 作为 baseRevision；新作品省略这两项。submissionId 同次重试保持一致，修改设计使用新 ID。同账号的提交共用 submissionId 命名空间。组件接受标准设计或工具 nodes，主题直接传 ThemeTokens。")
            .inputSchema(inputSchema())
            .annotations(new McpToolAnnotations(false, false, true, false, "Submit design draft"))
            .permission(invocation -> caller.canUseTools())
            .handler(invocation -> executor.execute(invocation, owner ->
                drafts.submit(owner, mapper.valueToTree(invocation.arguments())).map(draft -> (Object) Map.of(
                    "draftId", draft.id(), "title", draft.title(), "status", "pending",
                    "message", "草稿已提交。请在灵构工作台的「外部 AI 草稿」中预览与载入，确认后再保存项目。"))))
            .build());
    }

    private Map<String, Object> inputSchema() {
        return Map.of("type", "object", "additionalProperties", false,
                "properties", Map.of(
                    "submissionId", Map.of("type", "string", "pattern", "^[a-zA-Z0-9_-]{1,80}$"),
                    "title", Map.of("type", "string", "minLength", 1, "maxLength", 120),
                    "summary", Map.of("type", "string", "maxLength", 500, "description", "简述本次改动，供用户审核"),
                    "kind", Map.of("type", "string", "enum", List.of("component", "theme")),
                    "design", Map.of("type", "object"),
                    "workName", Map.of("type", "string", "minLength", 1, "maxLength", 160),
                    "baseRevision", Map.of("type", "integer", "minimum", 1)),
                "required", List.of("submissionId", "title", "kind", "design"));
    }
}
