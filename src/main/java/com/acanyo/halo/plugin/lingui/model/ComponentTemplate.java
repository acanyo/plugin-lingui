package com.acanyo.halo.plugin.lingui.model;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;
import run.halo.app.extension.AbstractExtension;
import run.halo.app.extension.GVK;

@Data
@EqualsAndHashCode(callSuper = true)
@GVK(group = "lingui.acanyo.com", version = "v1alpha1", kind = "ComponentTemplate",
    plural = "componenttemplates", singular = "componenttemplate")
public class ComponentTemplate extends AbstractExtension {
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    private TemplateSpec spec;

    @Data
    @Schema(name = "LinguiTemplateSpec")
    public static class TemplateSpec {
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 120)
        private String displayName;
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 80)
        private String category;
        @Schema(maxLength = 500)
        private String description;
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minimum = "1")
        private Integer revision;
        @Schema(description = "版本化 LingUI 文档的 JSON；读取、编辑和渲染前必须校验", requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 2097152)
        private String history;
    }
}
