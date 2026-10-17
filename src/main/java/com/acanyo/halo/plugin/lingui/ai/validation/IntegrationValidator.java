package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;

/** Portable descriptions and examples; no code execution or network access during review. */
final class IntegrationValidator {
    private IntegrationValidator() {}
    static void validate(JsonNode definitions) {
        if (definitions.isMissingNode()) return;
        for (String kind : new String[]{"apis", "callbacks"}) {
            var names = new HashSet<String>();
            for (var definition : definitions.path(kind)) {
                if (!names.add(definition.path("name").asText())) throw bad("接口或回调名称不能重复");
                if (definition.path("label").asText().isBlank()) throw bad("接口与回调需要显示名称");
                if (kind.equals("apis")) EventComponentValidator.url(definition.path("url").asText());
            }
        }
    }
}
