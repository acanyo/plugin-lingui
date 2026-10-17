package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import java.util.List;
import java.util.Map;

/** External-only mutation: creates a reviewable snapshot, never a project revision. */
public final class McpDraftTool {
    private McpDraftTool() {}
    public static Map<String, Object> definition() {
        return Map.of("name", "submit_design_draft", "description",
            "提交完整组件或主题草稿到工作台，供用户预览、对比和确认；不保存项目或发布。仅专门授权的密钥可用。修改已有项目必须提供 workName 和 get_current_work 返回的 revision 作为 baseRevision；新作品省略这两项。submissionId 同次重试保持一致，修改设计使用新 ID。组件接受标准设计或工具 nodes，主题直接传 ThemeTokens。",
            "inputSchema", Map.of("type", "object", "additionalProperties", false,
                "properties", Map.of(
                    "submissionId", Map.of("type", "string", "pattern", "^[a-zA-Z0-9_-]{1,80}$"),
                    "title", Map.of("type", "string", "minLength", 1, "maxLength", 120),
                    "summary", Map.of("type", "string", "maxLength", 500, "description", "简述本次改动，供用户审核"),
                    "kind", Map.of("type", "string", "enum", List.of("component", "theme")),
                    "design", Map.of("type", "object"),
                    "workName", Map.of("type", "string", "minLength", 1, "maxLength", 160),
                    "baseRevision", Map.of("type", "integer", "minimum", 1)),
                "required", List.of("submissionId", "title", "kind", "design")),
            "annotations", Map.of("readOnlyHint", false, "destructiveHint", false, "idempotentHint", true, "openWorldHint", false));
    }
}
