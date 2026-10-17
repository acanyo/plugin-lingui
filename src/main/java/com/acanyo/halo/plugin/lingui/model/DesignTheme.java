package com.acanyo.halo.plugin.lingui.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "lingui.acanyo.com", version = "v1alpha1", kind = "DesignTheme",
    plural = "designthemes", singular = "designtheme")
public class DesignTheme extends AbstractExtension {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private ThemeSpec spec;

    @Data
    @Schema(name = "LinguiThemeSpec")
    public static class ThemeSpec {
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 120)
        private String displayName;
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 262144)
        private String tokens;
    }
}
