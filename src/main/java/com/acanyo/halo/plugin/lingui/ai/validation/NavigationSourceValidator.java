package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;

/** Mirrors the shared renderer's click-only navigation URL contract. */
final class NavigationSourceValidator {
    private NavigationSourceValidator() {}

    static void validate(JsonNode node) {
        if (java.util.Set.of("LingUI.Link", "LingUI.FileCard").contains(node.path("component").asText()) && node.path("url").isTextual()) {
            validateUrl(node.path("url").asText());
        }
        for (var item : node.path("items")) {
            if (item.has("url")) validateUrl(item.path("url").asText());
        }
    }

    private static void validateUrl(String value) {
        if (value.startsWith("#")) {
            if (value.length() > 2048 || value.chars().anyMatch(c -> Character.isWhitespace(c) || c < 32 || c == 127 || c == '\\')) {
                throw bad("导航锚点地址无效");
            }
            return;
        }
        MediaSourceValidator.validateUrl(value);
    }
}
