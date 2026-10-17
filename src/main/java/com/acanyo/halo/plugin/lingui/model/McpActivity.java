package com.acanyo.halo.plugin.lingui.model;

import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/** Safe operation metadata, never request bodies, designs or credentials. */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "internal.lingui.acanyo.com", version = "v1alpha1", kind = "McpActivity", plural = "mcpactivities", singular = "mcpactivity")
public class McpActivity extends AbstractExtension {
    private ActivitySpec spec;
    @Data
    public static class ActivitySpec {
        private String owner;
        private String keyId;
        private String keyName;
        private String operation;
        private String summary;
        private String workName;
        private String status;
        private String createdAt;
        private Long elapsedMs;
    }
}
