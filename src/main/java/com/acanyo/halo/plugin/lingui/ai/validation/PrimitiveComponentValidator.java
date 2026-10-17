package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Set;

/** Reference semantics for composable non-modal content. */
final class PrimitiveComponentValidator {
    private PrimitiveComponentValidator() {}

    static void validate(JsonNode node, Map<String, JsonNode> nodes) {
        if (!node.path("component").asText().equals("LingUI.Popover")) return;
        if (node.path("trigger").equals(node.path("content"))) {
            throw bad("浮层的触发器和内容不能相同");
        }
        var trigger = nodes.get(node.path("trigger").asText());
        if (trigger == null || !Set.of("Button", "LingUI.IconButton").contains(trigger.path("component").asText())) {
            throw bad("浮层触发器需要使用按钮或图标按钮");
        }
    }
}
