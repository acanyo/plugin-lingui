package com.acanyo.halo.plugin.lingui.ai.tools;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Searches summaries and returns complete schemas with only their transitive local definitions. */
@Component
public class ComponentCatalog {
    private final ObjectMapper mapper = new ObjectMapper();
    private final JsonNode catalog;
    private final JsonNode labels;

    public ComponentCatalog() throws IOException {
        catalog = load("protocol/catalog.json");
        labels = load("protocol/component-summaries.json");
    }

    private JsonNode load(String path) throws IOException {
        try (var stream = new ClassPathResource(path, getClass().getClassLoader()).getInputStream()) {
            return mapper.readTree(stream);
        }
    }

    public Object search(String query, int offset, int limit) {
        var words = query.strip().toLowerCase(Locale.ROOT).split("[\\s,，、]+");
        var matches = new ArrayList<JsonNode>();
        catalog.path("components").fieldNames().forEachRemaining(name -> {
            var label = labels.path(name);
            String haystack = (name + " " + label.path("label").asText() + " "
                + label.path("description").asText()).toLowerCase(Locale.ROOT);
            if (query.isBlank() || java.util.Arrays.stream(words).anyMatch(haystack::contains)) {
                var item = mapper.createObjectNode().put("name", name)
                    .put("sourceName", name.replace("LingUI.", "LingUI_"))
                    .put("label", label.path("label").asText())
                    .put("description", label.path("description").asText());
                matches.add(item);
            }
        });
        return java.util.Map.of("catalogId", catalog.path("catalogId").asText(),
            "total", matches.size(), "offset", offset, "items",
            matches.stream().skip(offset).limit(limit).toList(),
            "hint", matches.isEmpty()
                ? "没有专用组件时请用基础 UI 组合。接口展示常用 Column、Card、Text、Button、LingUI.Metric、LingUI.Conditional；用 get_component_schemas 批量获取参数后实现。"
                : "请批量获取实际使用的组件参数后开始实现，无需遍历整个目录。",
            "nextOffset", offset + limit < matches.size() ? offset + limit : -1);
    }

    public JsonNode schemas(List<String> names) {
        var result = mapper.createObjectNode();
        result.put("$schema", catalog.path("$schema").asText());
        result.put("catalogId", catalog.path("catalogId").asText());
        var components = result.putObject("components");
        var unknown = result.putArray("unknownComponents");
        var needed = new LinkedHashSet<String>();
        for (String input : names) {
            String name = canonicalName(input);
            var schema = catalog.path("components").get(name);
            if (schema == null) { unknown.add(input); continue; }
            components.set(name, schema.deepCopy());
            collect(schema, needed);
        }
        if (components.isEmpty()) throw new IllegalArgumentException("组件不存在：" + unknown
            + "；基础组合可用 Column、Row、Card、Text、Button、LingUI.Metric、LingUI.Conditional，请按准确名称查询");
        if (!unknown.isEmpty()) result.put("hint", "unknownComponents 中的组件不存在；其余 schema 已返回，优先使用已知组件完成需求，不要猜测字段");
        collect(catalog.path("functions"), needed);
        ObjectNode definitions = result.putObject("$defs");
        for (String name : needed) definitions.set(name, catalog.path("$defs").path(name).deepCopy());
        result.set("functions", catalog.path("functions").deepCopy());
        return result;
    }

    private String canonicalName(String input) {
        String name = input.replace("LingUI_", "LingUI.");
        var components = catalog.path("components");
        if (components.has(name)) return name;
        String shortName = name.startsWith("LingUI.") ? name.substring(7) : name;
        if (components.has(shortName)) return shortName;
        if (components.has("LingUI." + shortName)) return "LingUI." + shortName;
        return name;
    }

    private void collect(JsonNode value, Set<String> needed) {
        if (value.isObject() && value.has("$ref")) {
            String ref = value.path("$ref").asText();
            if (!ref.startsWith("#/$defs/")) throw new IllegalStateException("Catalog contains non-local reference");
            String name = ref.substring("#/$defs/".length());
            if (needed.add(name)) collect(catalog.path("$defs").path(name), needed);
        }
        if (value.isContainerNode()) value.forEach(child -> collect(child, needed));
    }
}
