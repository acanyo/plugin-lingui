package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.io.JsonEOFException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** A preflight for tool feedback; the client still runs its renderer and runtime contract checks. */
@Component
public class DesignValidator {
    public void requireTheme(JsonNode theme) {
        var errors = ProtocolSchemas.THEME.validate(theme);
        if (!errors.isEmpty()) throw new IllegalArgumentException(errors.iterator().next().getMessage());
        if (theme.path("name").asText().isBlank()) throw new IllegalArgumentException("主题名称不能为空");
        FontSourceValidator.validate(theme.path("customFont"));
    }
    /** Tool-only convenience input; stored and returned designs always contain standard OpenUI source. */
    public JsonNode normalizeToolDesign(JsonNode input) {
        if (input == null || !input.isObject()) throw new IllegalArgumentException("设计必须是 JSON 对象");
        ObjectNode normalized = input.deepCopy();
        JsonNode document = normalized.has("schemaVersion") ? normalized : normalized.path("document");
        if (!document.has("nodes")) return normalized;
        if (document.has("source")) throw new IllegalArgumentException("工具设计的 nodes 与 source 只能选择一种");
        JsonNode nodes = document.path("nodes");
        if (!nodes.isArray() || nodes.isEmpty() || nodes.size() > 256)
            throw new IllegalArgumentException("nodes 必须包含 1–256 个组件");
        var list = new java.util.ArrayList<JsonNode>();
        var ids = new java.util.HashSet<String>();
        for (var node : nodes) {
            if (!node.isObject()) throw new IllegalArgumentException("nodes 中每个组件必须是对象");
            ProtocolSchemas.validateNode(node);
            if (!ids.add(node.path("id").asText())) throw new IllegalArgumentException("组件 ID 不能重复");
            list.add(node);
        }
        if (!ids.contains("root")) throw new IllegalArgumentException("nodes 必须包含 id 为 root 的根组件");
        var target = (ObjectNode) document;
        target.remove("nodes");
        target.put("source", OpenuiSource.serialize(list));
        return normalized;
    }

    public JsonNode parse(String text) {
        if (text == null || text.getBytes(StandardCharsets.UTF_8).length > 262144)
            throw new IllegalArgumentException("设计不能超过 256 KiB");
        try { return ProtocolSchemas.MAPPER.readTree(text); }
        catch (JsonProcessingException error) {
            // Jackson messages may contain the document itself. Expose only a category and position.
            String detail = error.getOriginalMessage();
            String issue = detail != null && detail.startsWith("Duplicate field") ? "设计 JSON 存在重复字段"
                : error instanceof JsonEOFException ? "设计 JSON 未完整结束，请补齐对象、数组或字符串"
                : detail != null && detail.startsWith("Trailing token") ? "设计 JSON 后存在多余内容，只能返回一个设计对象"
                : "设计 JSON 语法错误，请检查引号、逗号与转义";
            var location = error.getLocation();
            if (location != null && location.getLineNr() > 0 && location.getColumnNr() > 0)
                issue += "（第 " + location.getLineNr() + " 行，第 " + location.getColumnNr() + " 列）";
            throw new IllegalArgumentException(issue);
        }
    }

    public Object validate(JsonNode input) {
        try {
            requireValid(input);
            return Map.of("valid", true, "issues", List.of(), "scope",
                "组件 Schema、OpenUI 引用、状态路径、动作与主题预检；应用前仍需工作台完整校验与交互验证");
        } catch (IllegalArgumentException error) {
            return Map.of("valid", false, "issues", List.of(Map.of("message", error.getMessage())));
        }
    }

    public void requireValid(JsonNode input) {
        if (input == null || !input.isObject()) throw new IllegalArgumentException("设计必须是 JSON 对象");
        ObjectNode design;
        if (input.has("schemaVersion")) {
            design = ProtocolSchemas.MAPPER.createObjectNode();
            design.set("document", input);
        } else design = (ObjectNode) input;
        var errors = ProtocolSchemas.DESIGN.validate(design);
        if (!errors.isEmpty()) throw new IllegalArgumentException(errors.iterator().next().getMessage());
        InstanceValidator.validate(design);
        var document = design.path("document");
        var nodes = OpenuiSource.parse(document.path("source").asText());
        SelectionExpressionValidator.validate(nodes);
        checkNamedActions(document, nodes);
    }

    private void checkNamedActions(JsonNode document, Map<String, JsonNode> nodes) {
        for (var node : nodes.values()) {
            for (var binding : node.path("events")) {
                for (String branch : List.of("actions", "onSuccess", "onError")) {
                    for (var action : binding.path(branch)) {
                        String kind = action.path("type").asText();
                        if (!List.of("api", "callback").contains(kind)) continue;
                        String name = action.path("name").asText();
                        if (kind.equals("callback") && List.of("lingui.log", "lingui.notify").contains(name)) continue;
                        var definitions = document.path("integrations").path(kind.equals("api") ? "apis" : "callbacks");
                        boolean found = false;
                        for (var definition : definitions) if (name.equals(definition.path("name").asText())) found = true;
                        if (!found) throw new IllegalArgumentException("组件 " + node.path("id").asText()
                            + " 引用了未配置的" + (kind.equals("api") ? "接口：" : "回调：") + name);
                    }
                }
            }
        }
    }
}
