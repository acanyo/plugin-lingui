package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public final class McpKeyDtos {
    private McpKeyDtos() {}
    public record CreateMcpKeyRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 80) String name,
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1", maximum = "365") Integer expiresInDays,
        @Schema(description = "可读取的项目资源名称；allWorks 为 false 时，空列表只允许组件查询、Skill 与设计校验") List<String> workNames,
        @Schema(description = "允许读取当前账号有权访问的全部项目，包含以后新建的项目；默认 false") Boolean allWorks,
        @Schema(description = "单独允许提交外部 AI 草稿，默认 false；不能保存或发布项目") Boolean submitDrafts) {
        public CreateMcpKeyRequest(String name, Integer days, List<String> works, Boolean allWorks) {
            this(name, days, works, allWorks, false);
        }
    }
    public record McpKeyInfo(String id, String name, String prefix, String createdAt,
        String expiresAt, String lastUsedAt, boolean revoked, List<String> workNames, boolean allWorks, boolean submitDrafts) {}
    public record McpKeyList(List<McpKeyInfo> items) {}
    public record IssuedMcpKey(McpKeyInfo key, String token) {}
}
