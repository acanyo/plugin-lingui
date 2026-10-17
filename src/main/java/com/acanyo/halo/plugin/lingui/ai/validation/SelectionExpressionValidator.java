package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Catches scalar equality against ChoicePicker's guaranteed array value before model repair ends. */
final class SelectionExpressionValidator {
    private SelectionExpressionValidator() {}

    static void validate(Map<String, JsonNode> nodes) {
        Set<String> arrays = nodes.values().stream()
            .filter(node -> node.path("component").asText().equals("ChoicePicker"))
            .map(node -> node.path("value").path("path").asText())
            .filter(path -> !path.isEmpty()).collect(Collectors.toSet());
        for (var node : nodes.values()) {
            check(node.path("condition"), arrays);
            computed(node, arrays);
        }
    }

    private static void computed(JsonNode value, Set<String> arrays) {
        if (value.path("call").asText().equals("lingui.evaluate"))
            check(value.path("args").path("expression"), arrays);
        if (value.isArray()) value.forEach(child -> computed(child, arrays));
        else if (value.isObject()) value.fields().forEachRemaining(entry -> {
            if (!entry.getKey().equals("events")) computed(entry.getValue(), arrays);
        });
    }

    private static void check(JsonNode expression, Set<String> arrays) {
        var args = expression.path("args");
        if (Set.of("eq", "neq").contains(expression.path("op").asText()) && args.size() == 2) {
            for (int index = 0; index < 2; index++) {
                var path = args.get(index).path("path").asText();
                var other = args.get(1 - index);
                if (arrays.contains(path) && other.isValueNode() && !other.isNull())
                    throw new IllegalArgumentException("ChoicePicker 的 " + path
                        + " 是字符串数组，不能用 eq/neq 与单值比较；选中判断请用 includes，计分与条件显示也需使用 includes");
            }
        }
        args.forEach(arg -> check(arg, arrays));
    }
}
