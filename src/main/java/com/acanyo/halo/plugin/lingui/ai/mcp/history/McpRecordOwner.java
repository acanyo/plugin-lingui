package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.Metadata;

final class McpRecordOwner {
    private static final String LABEL = "lingui.acanyo.com/mcp-record-owner";
    private McpRecordOwner() {}
    private static String tag(String owner) {
        return UUID.nameUUIDFromBytes(owner.getBytes(StandardCharsets.UTF_8)).toString();
    }
    static Metadata metadata(String name, String owner) {
        var metadata = new Metadata();
        metadata.setName(name);
        metadata.setLabels(Map.of(LABEL, tag(owner)));
        return metadata;
    }
    static ListOptions options(String owner) {
        return ListOptions.builder().labelSelector().eq(LABEL, tag(owner)).end().build();
    }
}
