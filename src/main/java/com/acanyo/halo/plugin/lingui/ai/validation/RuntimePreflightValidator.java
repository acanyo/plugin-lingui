package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Replays response examples through the declarative state and collection-binding
 * layer. It never opens a network connection or executes callbacks.
 */
public final class RuntimePreflightValidator {
    private static final int MAX_ISSUES = 32;

    public Report inspect(JsonNode input) {
        if (input == null || !input.isObject()) return Report.empty();
        JsonNode document = input.has("schemaVersion") ? input : input.path("document");
        if (!document.isObject() || !document.has("source")) return Report.empty();
        var definitions = new HashMap<String, JsonNode>();
        document.path("integrations").path("apis").forEach(api -> {
            String name = api.path("name").asText();
            if (!name.isBlank()) definitions.put(name, api);
        });
        if (definitions.isEmpty()) return Report.empty();

        JsonNode state = document.path("state").deepCopy();
        if (!(state instanceof ObjectNode stateObject)) return Report.empty();
        var issues = new ArrayList<Map<String, Object>>();
        var responsePaths = new ArrayList<String>();
        int checkedApis = 0;
        var nodes = OpenuiSource.parse(document.path("source").asText());
        for (var entry : nodes.entrySet()) {
            JsonNode node = entry.getValue();
            JsonNode events = node.path("events");
            var eventNames = events.fieldNames();
            while (eventNames.hasNext()) {
                String eventName = eventNames.next();
                JsonNode binding = events.path(eventName);
                for (String branch : List.of("actions", "onSuccess", "onError")) {
                    int index = 0;
                    for (var action : binding.path(branch)) {
                        if ("api".equals(action.path("type").asText())) {
                            var definition = definitions.get(action.path("name").asText());
                            if (definition != null && definition.has("responseExample")) {
                                checkedApis++;
                                applyResponseExample(entry.getKey(), eventName, branch, index,
                                    action, binding, definition.path("responseExample"), stateObject,
                                    responsePaths, issues);
                            }
                        }
                        index++;
                    }
                }
            }
        }

        int checkedBindings = 0;
        for (var entry : nodes.entrySet()) {
            // A node can expose several named collection bindings; inspect each
            // map entry so a response example catches the exact field that fails.
            var fields = entry.getValue().path("bindings").fields();
            while (fields.hasNext()) {
                var named = fields.next();
                String sourcePath = named.getValue().path("path").asText();
                if (responsePaths.stream().noneMatch(target -> isWithin(sourcePath, target))) continue;
                checkedBindings++;
                inspectBinding(entry.getValue(), entry.getKey(), named.getKey(), named.getValue(), stateObject, issues);
            }
        }
        return new Report(checkedApis, checkedBindings, List.copyOf(issues));
    }

    public void requireValid(JsonNode input) {
        var report = inspect(input);
        if (!report.issues().isEmpty()) {
            throw new IllegalArgumentException(String.valueOf(report.issues().getFirst().get("message")));
        }
    }

    private void applyResponseExample(String nodeId, String event, String branch, int action,
        JsonNode actionNode, JsonNode binding, JsonNode response, ObjectNode state,
        List<String> responsePaths, List<Map<String, Object>> issues) {
        String path = actionNode.path("resultPath").asText();
        if (path.isBlank()) path = binding.path("resultPath").asText();
        if (path.isBlank()) {
            issue(issues, nodeId, event, branch, action,
                "接口示例响应没有 resultPath，无法注入状态并验证组件绑定");
            return;
        }
        try {
            InstanceValidator.write(state, path, response.deepCopy());
            responsePaths.add(path);
        } catch (IllegalArgumentException error) {
            issue(issues, nodeId, event, branch, action,
                "接口示例响应无法写入 " + path + "：" + error.getMessage());
        }
    }

    private static boolean isWithin(String path, String target) {
        return path.equals(target) || path.startsWith(target + "/");
    }

    private void inspectBinding(JsonNode node, String nodeId, String name, JsonNode binding, ObjectNode state,
        List<Map<String, Object>> issues) {
        String path = binding.path("path").asText();
        JsonNode source = read(state, path);
        if (source == null || source.isNull()) {
            issue(issues, nodeId, name, "bindings", 0,
                "示例响应缺少数据绑定路径 " + path);
            return;
        }
        if (!source.isArray()) {
            issue(issues, nodeId, name, "bindings", 0,
                "数据绑定路径 " + path + " 需要数组，示例响应返回了 " + source.getNodeType());
            return;
        }
        JsonNode map = binding.path("map");
        if (!map.isObject()) return;
        ArrayNode mapped = JsonNodeFactory.instance.arrayNode();
        boolean complete = true;
        for (JsonNode record : source) {
            var fields = map.fields();
            ObjectNode mappedRecord = JsonNodeFactory.instance.objectNode();
            while (fields.hasNext()) {
                var field = fields.next();
                JsonNode mapping = field.getValue();
                if (mapping.isArray()) {
                    var values = JsonNodeFactory.instance.arrayNode();
                    for (JsonNode item : mapping) {
                        JsonNode value = read(record, item.asText());
                        complete &= value != null;
                        if (value == null) issue(issues, nodeId, name, "bindings", 0,
                            "数据绑定 " + path + " 的字段路径 " + item.asText() + " 不在示例响应中");
                        values.add(value == null ? NullNode.getInstance() : value);
                    }
                    mappedRecord.set(field.getKey(), values);
                } else {
                    JsonNode value = read(record, mapping.asText());
                    complete &= value != null;
                    if (value == null) issue(issues, nodeId, name, "bindings", 0,
                        "数据绑定 " + path + " 的字段路径 " + mapping.asText() + " 不在示例响应中");
                    mappedRecord.set(field.getKey(), value == null ? NullNode.getInstance() : value);
                }
            }
            mapped.add(mappedRecord);
        }
        if (complete) {
            var resolved = (ObjectNode) node.deepCopy();
            resolved.set(name, mapped);
            try {
                ProtocolSchemas.validateNode(resolved);
            } catch (IllegalArgumentException error) {
                issue(issues, nodeId, name, "bindings", 0,
                    "示例响应映射后组件字段无效：" + error.getMessage());
            }
        }
    }

    private static JsonNode read(JsonNode root, String path) {
        if (root == null || path == null) return null;
        String[] segments;
        try {
            segments = InstanceValidator.segments(path);
        } catch (IllegalArgumentException error) {
            return null;
        }
        JsonNode current = root;
        for (String segment : segments) {
            if (current == null || current.isNull()) return null;
            if (current.isArray()) {
                if (!segment.matches("0|[1-9][0-9]{0,3}")) return null;
                current = current.path(Integer.parseInt(segment));
            } else if (current.isObject()) {
                current = current.get(segment);
            } else return null;
            if (current == null || current.isMissingNode()) return null;
        }
        return current;
    }

    private static void issue(List<Map<String, Object>> issues, String nodeId, String event,
        String branch, int action, String message) {
        if (issues.size() >= MAX_ISSUES) return;
        issues.add(Map.of("nodeId", nodeId, "event", event, "branch", branch,
            "action", action, "message", message));
    }

    public record Report(int checkedApis, int checkedBindings, List<Map<String, Object>> issues) {
        static Report empty() { return new Report(0, 0, List.of()); }
    }
}
