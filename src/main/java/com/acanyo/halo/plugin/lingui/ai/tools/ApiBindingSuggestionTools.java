package com.acanyo.halo.plugin.lingui.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Read-only suggestions that turn an API response shape into OpenUI bindings. */
final class ApiBindingSuggestionTools {
    private static final List<String> DEFAULT_COMPONENTS = List.of(
        "List", "LingUI.Table", "LingUI.BarChart", "LingUI.LineChart", "Text");
    private static final Set<String> LABEL_NAMES = Set.of(
        "name", "title", "label", "displayname", "text", "date", "time", "category");
    private static final Set<String> ID_NAMES = Set.of("id", "key", "slug", "uuid", "code");
    private static final Set<String> DESCRIPTION_NAMES = Set.of(
        "summary", "description", "excerpt", "subtitle", "content");

    private ApiBindingSuggestionTools() {
    }

    static List<CreationTools.Definition> definitions() {
        return List.of(new CreationTools.Definition("suggest_api_bindings",
            "根据 get_public_api 返回的契约或 responseExample 推荐 List、Table、图表和文本绑定。只生成声明式候选，不请求接口、不保存设计。",
            schema(Map.of(
                "contract", Map.of("type", "object"),
                "components", Map.of("type", "array", "minItems", 1, "maxItems", 5,
                    "items", Map.of("type", "string", "enum", DEFAULT_COMPONENTS),
                    "uniqueItems", true),
                "responsePath", Map.of("type", "string", "minLength", 1, "maxLength", 160,
                    "pattern", "^/"),
                "limit", Map.of("type", "integer", "minimum", 1, "maximum", 12,
                    "default", 8)), List.of("contract"))));
    }

    static Map<String, Object> suggest(JsonNode input) {
        JsonNode contract = firstContract(input.path("contract"));
        String responsePath = input.path("responsePath").asText("/response");
        validatePath(responsePath);
        int limit = input.path("limit").asInt(8);
        var requested = requestedComponents(input.path("components"));
        var warnings = new ArrayList<String>();
        if (contract.path("partial").asBoolean(false)) warnings.add("接口契约是 partial，建议先人工确认字段");
        JsonNode shape = responseShape(contract, warnings);
        var result = new LinkedHashMap<String, Object>();
        result.put("status", shape.isMissingNode() || shape.isNull() ? "insufficient_data" : "ok");
        result.put("responsePath", responsePath);
        result.put("shape", summarize(shape, contract, 0));
        var arrays = new ArrayList<ArrayCandidate>();
        if (!shape.isMissingNode() && !shape.isNull()) findArrays(shape, "", contract, arrays, 0);
        var suggestions = new ArrayList<Map<String, Object>>();
        for (String component : requested) {
            if (suggestions.size() >= limit) break;
            var suggestion = switch (component) {
                case "List" -> listSuggestion(arrays, responsePath);
                case "LingUI.Table" -> tableSuggestion(arrays, responsePath);
                case "LingUI.BarChart", "LingUI.LineChart" -> chartSuggestion(component, arrays, responsePath);
                case "Text" -> textSuggestion(shape, responsePath, contract);
                default -> null;
            };
            if (suggestion != null) suggestions.add(suggestion);
        }
        if (suggestions.isEmpty()) {
            warnings.add(shape.isMissingNode() || shape.isNull()
                ? "契约没有 responseExample 或可解析的响应 schema，暂时无法生成绑定候选"
                : "响应中没有适合所选组件的对象数组或标量字段");
        }
        result.put("suggestions", suggestions);
        result.put("warnings", warnings);
        result.put("anonymousAccess", "unverified");
        return result;
    }

    private static Map<String, Object> listSuggestion(List<ArrayCandidate> arrays, String base) {
        for (var array : arrays) {
            var fields = fields(array.item());
            var label = choose(fields, LABEL_NAMES, "string");
            if (label == null) continue;
            var map = new LinkedHashMap<String, String>();
            var id = choose(fields, ID_NAMES, null);
            var description = choose(fields, DESCRIPTION_NAMES, "string");
            if (id != null) map.put("id", id.path());
            map.put("label", label.path());
            if (description != null && !description.path().equals(label.path())) map.put("description", description.path());
            return suggestion("List", base, Map.of("items", Map.of(
                "path", join(base, array.path()), "map", map)),
                Map.of("arrayPath", join(base, array.path()), "fields", fieldNames(fields)));
        }
        return null;
    }

    private static Map<String, Object> tableSuggestion(List<ArrayCandidate> arrays, String base) {
        for (var array : arrays) {
            var fields = fields(array.item());
            var label = choose(fields, LABEL_NAMES, "string");
            if (label == null) continue;
            var cells = fields.stream().filter(field -> !field.path().equals(label.path())
                    && isScalar(field.type())).limit(5).toList();
            if (cells.isEmpty()) continue;
            var cellPaths = cells.stream().map(Field::path).toList();
            var columns = new ArrayList<String>();
            columns.add(displayName(label.name()));
            cells.forEach(field -> columns.add(displayName(field.name())));
            return suggestion("LingUI.Table", base, Map.of(
                "rows", Map.of("path", join(base, array.path()), "map",
                    Map.of("label", label.path(), "cells", cellPaths))),
                Map.of("columns", columns, "arrayPath", join(base, array.path()), "fields", fieldNames(fields)));
        }
        return null;
    }

    private static Map<String, Object> chartSuggestion(String component, List<ArrayCandidate> arrays, String base) {
        for (var array : arrays) {
            var fields = fields(array.item());
            var label = choose(fields, LABEL_NAMES, "string");
            var value = fields.stream().filter(field -> isNumber(field.type())).findFirst().orElse(null);
            if (label == null || value == null) continue;
            return suggestion(component, base, Map.of(
                "data", Map.of("path", join(base, array.path()), "map",
                    Map.of("label", label.path(), "value", value.path()))),
                Map.of("labelField", label.path(), "valueField", value.path(),
                    "arrayPath", join(base, array.path()), "fields", fieldNames(fields)));
        }
        return null;
    }

    private static Map<String, Object> textSuggestion(JsonNode shape, String base, JsonNode contract) {
        var fields = fields(shape);
        var field = fields.stream().filter(item -> isScalar(item.type())).findFirst().orElse(null);
        if (field == null) return null;
        return suggestion("Text", base, Map.of(
            "text", Map.of("path", join(base, field.path()))),
            Map.of("field", join(base, field.path()), "type", field.type(),
                "source", contract.has("responseExample") ? "responseExample" : "responseSchema"));
    }

    private static Map<String, Object> suggestion(String component, String responsePath,
        Map<String, Object> binding, Map<String, Object> evidence) {
        return Map.of("component", component, "binding", binding, "responsePath", responsePath,
            "confidence", "shape-derived", "evidence", evidence);
    }

    private static List<String> requestedComponents(JsonNode value) {
        if (!value.isArray() || value.isEmpty()) return DEFAULT_COMPONENTS;
        var result = new ArrayList<String>();
        value.forEach(item -> {
            if (DEFAULT_COMPONENTS.contains(item.asText()) && !result.contains(item.asText())) result.add(item.asText());
        });
        return result.isEmpty() ? DEFAULT_COMPONENTS : result;
    }

    private static JsonNode firstContract(JsonNode value) {
        if (value.path("items").isArray()) {
            for (JsonNode item : value.path("items")) {
                if (!item.has("status") || "ok".equals(item.path("status").asText())) return item;
            }
        }
        return value;
    }

    private static JsonNode responseShape(JsonNode contract, List<String> warnings) {
        if (contract.has("responseExample")) return contract.path("responseExample");
        JsonNode responses = contract.path("responses");
        if (!responses.isObject()) return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
        var codes = new ArrayList<String>();
        responses.fieldNames().forEachRemaining(codes::add);
        codes.sort(Comparator.comparingInt(ApiBindingSuggestionTools::responseRank));
        for (String code : codes) {
            JsonNode content = responses.path(code).path("content");
            var media = content.fields();
            while (media.hasNext()) {
                JsonNode schema = media.next().getValue().path("schema");
                if (!schema.isMissingNode() && !schema.isNull()) return resolveSchema(schema, contract, 0);
            }
        }
        warnings.add("响应 schema 没有可解析的 JSON content");
        return com.fasterxml.jackson.databind.node.MissingNode.getInstance();
    }

    private static int responseRank(String code) {
        try {
            int value = Integer.parseInt(code);
            return value >= 200 && value < 300 ? value : 10000 + value;
        } catch (NumberFormatException error) {
            return "default".equals(code) ? 9000 : 11000;
        }
    }

    private static JsonNode resolveSchema(JsonNode schema, JsonNode contract, int depth) {
        if (depth > 6 || schema == null || schema.isMissingNode()) return schema;
        String ref = schema.path("$ref").asText();
        if (ref.startsWith("#/components/schemas/")) {
            String name = ref.substring("#/components/schemas/".length());
            JsonNode resolved = contract.path("components").path("schemas").path(name);
            return resolved.isMissingNode() ? schema : resolveSchema(resolved, contract, depth + 1);
        }
        return schema;
    }

    private static void findArrays(JsonNode node, String path, JsonNode contract,
        List<ArrayCandidate> result, int depth) {
        if (depth > 6 || result.size() >= 12 || node == null || node.isMissingNode()) return;
        JsonNode resolved = resolveSchema(node, contract, depth);
        if (resolved.isArray()) {
            JsonNode item = resolved.size() > 0 ? resolved.get(0) : com.fasterxml.jackson.databind.node.MissingNode.getInstance();
            if (item.isObject() || item.has("properties")) result.add(new ArrayCandidate(path, item));
            findArrays(item, path + "/0", contract, result, depth + 1);
            return;
        }
        if (resolved.path("type").asText().equals("array")) {
            JsonNode item = resolveSchema(resolved.path("items"), contract, depth + 1);
            if (item.isObject() || item.has("properties")) result.add(new ArrayCandidate(path, item));
            findArrays(item, path + "/0", contract, result, depth + 1);
            return;
        }
        var fields = objectFields(resolved);
        for (var field : fields) {
            findArrays(field.getValue(), path + "/" + escape(field.getKey()), contract, result, depth + 1);
        }
    }

    private static List<Field> fields(JsonNode node) {
        var result = new ArrayList<Field>();
        for (var entry : objectFields(node)) {
            JsonNode value = entry.getValue();
            String type = type(value);
            if (!type.equals("object") && !type.equals("array"))
                result.add(new Field(entry.getKey(), "/" + escape(entry.getKey()), type));
        }
        return result;
    }

    private static List<Map.Entry<String, JsonNode>> objectFields(JsonNode node) {
        JsonNode properties = node.path("properties");
        var result = new ArrayList<Map.Entry<String, JsonNode>>();
        if (properties.isObject()) properties.fields().forEachRemaining(result::add);
        else if (node.isObject()) node.fields().forEachRemaining(entry -> result.add(entry));
        return result;
    }

    private static String type(JsonNode value) {
        String type = value.path("type").asText();
        if (!type.isBlank()) return type;
        if (value.isTextual()) return "string";
        if (value.isNumber()) return "number";
        if (value.isBoolean()) return "boolean";
        if (value.isArray()) return "array";
        if (value.isObject()) return "object";
        return "unknown";
    }

    private static Map<String, Object> summarize(JsonNode node, JsonNode contract, int depth) {
        if (node == null || node.isMissingNode() || depth > 4) return Map.of("kind", "unknown");
        JsonNode resolved = resolveSchema(node, contract, depth);
        String kind = type(resolved);
        var result = new LinkedHashMap<String, Object>();
        result.put("kind", kind);
        if (resolved.isArray() || "array".equals(kind)) {
            JsonNode item = resolved.isArray() && resolved.size() > 0 ? resolved.get(0) : resolved.path("items");
            result.put("item", summarize(item, contract, depth + 1));
        } else if (resolved.isObject() || "object".equals(kind)) {
            var names = objectFields(resolved).stream().map(Map.Entry::getKey).limit(24).toList();
            result.put("fields", names);
        }
        return result;
    }

    private static Field choose(List<Field> fields, Set<String> names, String type) {
        return fields.stream().filter(field -> (type == null || type.equals(field.type()))
                && names.contains(field.name().toLowerCase(Locale.ROOT))).findFirst()
            .orElseGet(() -> fields.stream().filter(field -> type == null || type.equals(field.type())).findFirst().orElse(null));
    }

    private static List<String> fieldNames(List<Field> fields) {
        return fields.stream().map(Field::name).toList();
    }

    private static boolean isScalar(String type) {
        return Set.of("string", "number", "integer", "boolean").contains(type);
    }

    private static boolean isNumber(String type) {
        return Set.of("number", "integer").contains(type);
    }

    private static String displayName(String value) {
        if (value.isBlank()) return "字段";
        return Arrays.stream(value.replaceAll("([a-z0-9])([A-Z])", "$1 $2").split("[_-]"))
            .map(part -> part.isEmpty() ? part : Character.toUpperCase(part.charAt(0)) + part.substring(1))
            .reduce((left, right) -> left + " " + right).orElse(value);
    }

    private static String join(String base, String relative) {
        if (relative == null || relative.isBlank() || relative.equals("/")) return base;
        return base + (relative.startsWith("/") ? relative : "/" + relative);
    }

    private static String escape(String value) {
        return value.replace("~", "~0").replace("/", "~1");
    }

    private static void validatePath(String path) {
        if (path == null || !path.startsWith("/") || path.length() > 160 || path.matches(".*[\\\\\\s].*"))
            throw new IllegalArgumentException("responsePath 必须是安全的 JSON Pointer");
    }

    private static Map<String, Object> schema(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "object", "properties", properties,
            "required", required, "additionalProperties", false);
    }

    private record ArrayCandidate(String path, JsonNode item) { }
    private record Field(String name, String path, String type) { }
}
