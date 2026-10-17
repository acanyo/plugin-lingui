package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;
import java.util.regex.Pattern;

/** Parses the same bounded OpenUI Lang profile as the client, without executing source. */
final class OpenuiSource {
    private static final ObjectMapper MAPPER = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final Pattern LINE = Pattern.compile("^([A-Za-z_][A-Za-z0-9_]*)\\s*=\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*\\((.*),\\s*\\[([A-Za-z0-9_,\\s]*)\\]\\s*\\)\\s*;?$");
    private OpenuiSource() {}
    static Map<String, JsonNode> parse(String source) {
        if (source == null || source.isBlank() || source.length() > 262144) throw bad("OpenUI 源码无效或过大");
        Map<String, JsonNode> byId = new LinkedHashMap<>();
        Map<String, String> names = new LinkedHashMap<>();
        Map<String, List<String>> refs = new LinkedHashMap<>();
        for (String line : source.strip().split("\n")) {
            if (line.isBlank()) continue;
            var match = LINE.matcher(line.strip());
            if (!match.matches()) throw bad("OpenUI 语法无效");
            String name = match.group(1), type = match.group(2);
            ObjectNode config;
            try {
                var value = MAPPER.readTree(match.group(3));
                if (!value.isObject() || value.has("component")) throw bad("OpenUI 配置格式无效");
                config = (ObjectNode) value;
            } catch (Exception exception) { throw bad("OpenUI 配置 JSON 无效"); }
            config.put("component", type.startsWith("LingUI_") ? type.replaceFirst("LingUI_", "LingUI.") : type);
            ProtocolSchemas.validateNode(config);
            String id = config.path("id").asText();
            if (Set.of("__proto__", "constructor", "prototype").contains(name)
                || Set.of("__proto__", "constructor", "prototype").contains(id)) throw bad("OpenUI 节点或声明标识不安全");
            if (names.putIfAbsent(name, id) != null || byId.putIfAbsent(id, config) != null) throw bad("OpenUI 节点或声明重复");
            if (name.equals("root") != id.equals("root")) throw bad("OpenUI root 声明无效");
            refs.put(name, match.group(4).isBlank() ? List.of() : Arrays.stream(match.group(4).split(",")).map(String::strip).toList());
            if (byId.size() > 256) throw bad("最多允许 256 个组件");
        }
        if (!names.containsKey("root")) throw bad("OpenUI 根节点缺失");
        Set<String> visited = new HashSet<>();
        visit("root", names, refs, new HashSet<>(), visited, new int[]{0});
        if (visited.size() != names.size()) throw bad("OpenUI 存在未连接的组件");
        for (var entry : names.entrySet()) {
            var node = byId.get(entry.getValue());
            Set<String> contentIds = new HashSet<>();
            for (String ref : refs.get(entry.getKey())) contentIds.add(names.get(ref));
            for (String id : children(node)) if (!contentIds.contains(id)) throw bad("OpenUI content 缺少组件引用");
        }
        return byId;
    }
    private static void visit(String name, Map<String, String> names, Map<String, List<String>> refs,
            Set<String> parents, Set<String> visited, int[] count) {
        if (++count[0] > 4096 || parents.size() > 32 || !parents.add(name)) throw bad("OpenUI 组件循环或层级超限");
        if (!names.containsKey(name)) throw bad("OpenUI 组件引用不存在");
        visited.add(name);
        for (String ref : refs.get(name)) visit(ref, names, refs, new HashSet<>(parents), visited, count);
    }
    static List<String> children(JsonNode node) {
        List<String> result = new ArrayList<>();
        node.path("children").forEach(child -> result.add(child.asText()));
        for (String key : List.of("child", "trigger", "content")) if (node.has(key)) result.add(node.path(key).asText());
        for (String key : List.of("tabs", "sections")) node.path(key).forEach(child -> result.add(child.path("child").asText()));
        return result;
    }
    private static void mark(String id, Map<String, JsonNode> nodes, Set<String> reachable) {
        if (!reachable.add(id) || !nodes.containsKey(id)) return;
        for (String child : children(nodes.get(id))) mark(child, nodes, reachable);
    }
    static String serialize(List<JsonNode> nodes) {
        Map<String, String> names = new HashMap<>();
        for (int i = 0; i < nodes.size(); i++) {
            String id = nodes.get(i).path("id").asText(); names.put(id, id.equals("root") ? "root" : "n" + i);
        }
        Map<String, JsonNode> lookup = new LinkedHashMap<>();
        for (var node : nodes) lookup.put(node.path("id").asText(), node);
        Set<String> reachable = new HashSet<>();
        mark("root", lookup, reachable);
        List<String> lines = new ArrayList<>();
        for (var node : nodes) {
            var config = ((ObjectNode) node).deepCopy(); config.remove("component");
            String type = node.path("component").asText().replace("LingUI.", "LingUI_");
            var references = new LinkedHashSet<>(children(node));
            if (node.path("id").asText().equals("root"))
                for (String id : lookup.keySet()) if (!reachable.contains(id)) references.add(id);
            List<String> content = references.stream().map(id -> names.getOrDefault(id, "missing")).toList();
            lines.add(names.get(node.path("id").asText()) + " = " + type + "(" + config + ", [" + String.join(", ", content) + "])");
        }
        return String.join("\n", lines);
    }
}
