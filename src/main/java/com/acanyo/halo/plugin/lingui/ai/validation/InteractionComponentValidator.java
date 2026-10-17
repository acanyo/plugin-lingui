package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.Set;

/** Local menu actions and repeatable fields share the renderer's bounded declarative contract. */
final class InteractionComponentValidator {
    private static final Set<String> UNSAFE = Set.of("__proto__", "constructor", "prototype");
    private InteractionComponentValidator() {}
    static void validate(JsonNode node) {
        validateAction(node.path("action"));
        var ids = new HashSet<String>();
        for (var item : node.path("menuItems")) {
            if (!ids.add(item.path("id").asText())) throw bad("菜单标识不能重复");
            validateAction(item.path("action"));
        }
        ids.clear();
        for (var field : node.path("fields")) {
            String key = field.path("key").asText();
            if (UNSAFE.contains(key) || !ids.add(key)) throw bad("字段标识必须安全且唯一");
        }
        if (node.has("fields") && node.path("minRows").asInt(0) > node.path("maxRows").asInt(10)) throw bad("行数范围无效");
    }
    private static void validateAction(JsonNode value) {
        for (var action : value.path("functionCall").path("args").path("actions")) {
            String type = action.path("type").asText();
            if (!type.equals("reset") && (!action.has("path") || action.path("path").asText().equals("/"))) throw bad("动作缺少有效状态路径");
            if (Set.of("setState", "selectOption").contains(type) && !action.has("value")) throw bad("动作缺少值");
        }
    }
}
