package com.acanyo.halo.plugin.lingui.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "lingui.acanyo.com", version = "v1alpha1", kind = "FontFamily",
    plural = "fontfamilies", singular = "fontfamily")
public class FontFamily extends AbstractExtension {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private FontSpec spec;

    @Data
    @Schema(name = "LinguiFontSpec")
    public static class FontSpec {
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 120)
        private String displayName;
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 196608)
        private String manifest;
        @Schema(maxLength = 2048)
        private String sourceUrl;
    }
}
