package com.acanyo.halo.plugin.lingui.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

/** Explicit public access to one saved project. No anonymous access to the underlying model. */
@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "internal.lingui.acanyo.com", version = "v1alpha1", kind = "ComponentEmbed",
    plural = "componentembeds", singular = "componentembed")
public class ComponentEmbed extends AbstractExtension {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private EmbedSpec spec;

    @Data
    public static class EmbedSpec {
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        private Boolean enabled;
    }
}
