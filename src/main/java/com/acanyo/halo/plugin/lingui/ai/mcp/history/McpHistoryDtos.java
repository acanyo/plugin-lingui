package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import java.util.List;

public final class McpHistoryDtos {
    private McpHistoryDtos() {}
    public record DraftInfo(String id, String title, String summary, String kind, String workName,
        Integer baseRevision, String createdAt, String loadedAt) {}
    public record DraftList(List<DraftInfo> items) {}
    public record DraftDetail(DraftInfo draft, String design) {}
    public record ActivityInfo(String id, String operation,
        String summary, String workName, String status, String createdAt, Long elapsedMs) {}
    public record ActivityList(List<ActivityInfo> items) {}
}
