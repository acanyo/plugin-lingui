package com.acanyo.halo.plugin.lingui.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/** Immutable external design snapshots; project storage is only changed by the workbench. */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "internal.lingui.acanyo.com", version = "v1alpha1", kind = "McpDraft", plural = "mcpdrafts", singular = "mcpdraft")
public class McpDraft extends AbstractExtension {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private DraftSpec spec;
    @Data
    public static class DraftSpec {
        private String owner;
        private String keyId;
        private String keyName;
        private String title;
        private String summary;
        private String kind;
        private String workName;
        private Integer baseRevision;
        private String createdAt;
        private String loadedAt;
        @Schema(maxLength = 262144)
        private String design;
    }
}
