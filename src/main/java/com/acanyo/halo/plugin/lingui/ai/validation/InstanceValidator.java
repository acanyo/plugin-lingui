package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Semantic checks supplement the renderer's pinned JSON schemas. Never executes user code. */
final class InstanceValidator {
    private static final Set<String> UNSAFE = Set.of("__proto__", "constructor", "prototype");
    private InstanceValidator() {}

    static void validate(JsonNode instance) {
        safe(instance, 0, new int[]{0}, false);
        if (instance.toString().getBytes(StandardCharsets.UTF_8).length > 262144) throw bad("组件不能超过 256 KiB");
        var document = instance.path("document");
        if (document.path("title").asText().isBlank() || (instance.has("theme") && instance.path("theme").path("name").asText().isBlank())) throw bad("组件与主题名称不能为空");
        IntegrationValidator.validate(document.path("integrations"));
        FontSourceValidator.validate(instance.path("theme").path("customFont"));
        Map<String, JsonNode> nodes = OpenuiSource.parse(document.path("source").asText());
        for (var node : nodes.values()) safe(node, 0, new int[]{0}, false);
        ObjectNode state = ((ObjectNode) document.path("state")).deepCopy();
        int[] references = {0};
        for (String id : nodes.keySet()) visit(id, nodes, new HashSet<>(), references);
        Set<String> declared = new HashSet<>();
        for (var parameter : document.path("parameters")) {
            String key = parameter.path("key").asText();
            if (!declared.add(key)) throw bad("组件参数重复");
            String type = parameter.path("type").asText();
            checkType(parameter.path("default"), type);
            String path = parameter.path("path").asText();
            if (path.equals("/")) throw bad("参数不能替换整个状态");
            var value = instance.path("parameters").has(key) ? instance.path("parameters").path(key) : parameter.path("default");
            checkType(value, type);
            checkRange(parameter);
            if (value.isNumber() && ((parameter.has("min") && value.asDouble() < parameter.path("min").asDouble())
                || (parameter.has("max") && value.asDouble() > parameter.path("max").asDouble()))) throw bad("参数超出范围");
            write(state, path, value);
        }
        instance.path("parameters").fieldNames().forEachRemaining(key -> {
            if (!declared.contains(key)) throw bad("存在未定义的参数");
        });
    }

    private static void visit(String id, Map<String, JsonNode> nodes, Set<String> parents, int[] references) {
        if (++references[0] > 4096 || parents.size() > 32) throw bad("组件树层数或展开次数超限");
        if (!parents.add(id)) throw bad("组件存在循环引用");
        var node = nodes.get(id);
        if (node == null) throw bad("组件引用不存在：" + id);
        if (!Set.of("DateTimeInput", "LingUI.DateRange").contains(node.path("component").asText())) checkRange(node);
        MediaSourceValidator.validate(node);
        NavigationSourceValidator.validate(node);
        AdvancedComponentValidator.validate(node);
        ProductivityComponentValidator.validate(node);
        WorkspaceComponentValidator.validate(node);
        PrimitiveComponentValidator.validate(node, nodes);
        Set<String> optionValues = new HashSet<>();
        for (var option : node.path("options")) {
            if (!optionValues.add(option.path("value").asText())) throw bad("选项值不能重复");
        }
        DateTimeBoundsValidator.validate(node);
        if ("LingUI.Table".equals(node.path("component").asText())) {
            for (var row : node.path("rows")) if (row.path("cells").size() != node.path("columns").size() - 1) throw bad("表格列数不一致");
        }
        InteractionComponentValidator.validate(node);
        EventComponentValidator.validate(node);
        DataBindingValidator.validate(node);
        List<String> children = new ArrayList<>();
        node.path("children").forEach(child -> children.add(child.asText()));
        if (node.has("child")) children.add(node.path("child").asText());
        if (node.has("trigger")) children.add(node.path("trigger").asText());
        if (node.has("content")) children.add(node.path("content").asText());
        node.path("tabs").forEach(tab -> children.add(tab.path("child").asText()));
        node.path("sections").forEach(section -> children.add(section.path("child").asText()));
        for (String child : children) visit(child, nodes, new HashSet<>(parents), references);
    }

    private static void checkRange(JsonNode value) {
        if (value.has("min") && value.has("max") && value.path("min").asDouble() > value.path("max").asDouble()) throw bad("最小值不能大于最大值");
    }
    private static void checkType(JsonNode value, String type) {
        if (!(switch (type) { case "string" -> value.isTextual(); case "number" -> value.isNumber(); case "boolean" -> value.isBoolean(); default -> false; })) throw bad("参数类型与声明不一致");
    }
    private static void safe(JsonNode value, int depth, int[] count, boolean source) {
        safe(value, depth, count, source, false);
    }
    private static void safe(JsonNode value, int depth, int[] count, boolean source, boolean literal) {
        if (depth > 48 || ++count[0] > 16000 || (value.isTextual() && value.textValue().length() > (source ? 262144 : 16000))
            || (value.isNumber() && !Double.isFinite(value.asDouble()))) throw bad("组件数据超出安全范围");
        if (value.isObject()) value.fields().forEachRemaining(entry -> {
            if (UNSAFE.contains(entry.getKey())) throw bad("包含不安全字段");
            if (!literal && entry.getKey().equals("path") && entry.getValue().isTextual()) segments(entry.getValue().asText());
            safe(entry.getValue(), depth + 1, count, entry.getKey().equals("source") && value.path("schemaVersion").asText().equals("lingui.document/2"), literal || Set.of("events", "state", "integrations").contains(entry.getKey()));
        });
        else if (value.isArray()) value.forEach(child -> safe(child, depth + 1, count, false, literal));
    }
    static String[] segments(String path) {
        if (!path.startsWith("/") || path.length() > 160 || path.matches(".*~(?![01]).*")) throw bad("状态路径无效");
        if (path.equals("/")) return new String[0];
        var parts = path.substring(1).split("/", -1);
        if (parts.length > 12) throw bad("状态路径层级过深");
        for (int i = 0; i < parts.length; i++) {
            parts[i] = parts[i].replace("~1", "/").replace("~0", "~");
            if (parts[i].isEmpty() || UNSAFE.contains(parts[i])) throw bad("状态路径不安全");
        }
        return parts;
    }
    static void write(JsonNode state, String path, JsonNode value) {
        var parts = segments(path);
        if (parts.length == 0) throw bad("状态路径不能是根节点");
        JsonNode target = state;
        for (int i = 0; i < parts.length; i++) {
            String key = parts[i];
            boolean last = i == parts.length - 1;
            JsonNode next = last ? value : target.get(key);
            if (target.isArray()) {
                if (!key.matches("0|[1-9][0-9]{0,3}") || Integer.parseInt(key) > 1024) throw bad("数组下标无效");
                int index = Integer.parseInt(key);
                var array = (com.fasterxml.jackson.databind.node.ArrayNode) target;
                if (!last) next = array.get(index);
                while (array.size() <= index) array.addNull();
                if (!last && next == null) next = JsonNodeFactory.instance.objectNode();
                array.set(index, next);
            } else if (target.isObject()) {
                var object = (ObjectNode) target;
                if (!last && next == null) next = JsonNodeFactory.instance.objectNode();
                if (next == null) object.remove(key); else object.set(key, next);
            } else throw bad("状态路径穿过非对象字段");
            if (!last) target = next;
        }
    }
}
