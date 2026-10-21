package com.acanyo.halo.plugin.lingui.ai.validation;

import com.acanyo.halo.plugin.lingui.ai.tools.PublicApiCatalog;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.BiFunction;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks that a design's named API actions still match the read-only Halo route
 * contracts discovered for the current instance. Custom and external integrations
 * remain portable and are intentionally left to their host at runtime.
 */
public final class ApiBindingValidator {
    private static final Pattern PATH_PARAMETER = Pattern.compile("\\{([^}/]+)}");
    private static final Set<String> DYNAMIC_ARGUMENTS = Set.of("$state", "$event", "$result", "$error");

    private final BiFunction<String, String, Map<String, Object>> contractLookup;

    public ApiBindingValidator(PublicApiCatalog catalog) {
        this(catalog == null ? null : catalog::contract);
    }

    ApiBindingValidator(BiFunction<String, String, Map<String, Object>> contractLookup) {
        this.contractLookup = contractLookup;
    }

    public List<Map<String, Object>> validate(JsonNode input) {
        if (contractLookup == null || input == null || !input.isObject()) return List.of();
        JsonNode document = input.has("schemaVersion") ? input : input.path("document");
        if (!document.isObject() || !document.has("source")) return List.of();
        Map<String, JsonNode> definitions = new HashMap<>();
        document.path("integrations").path("apis").forEach(api -> {
            String name = api.path("name").asText();
            if (!name.isBlank()) definitions.put(name, api);
        });
        if (definitions.isEmpty()) return List.of();

        var issues = new ArrayList<Map<String, Object>>();
        var nodes = OpenuiSource.parse(document.path("source").asText());
        for (var entry : nodes.entrySet()) {
            JsonNode node = entry.getValue();
            for (var event : node.path("events")) {
                for (String branch : List.of("actions", "onSuccess", "onError")) {
                    int index = 0;
                    for (var action : event.path(branch)) {
                        if (!"api".equals(action.path("type").asText())) {
                            index++;
                            continue;
                        }
                        var definition = definitions.get(action.path("name").asText());
                        if (definition != null) validateAction(entry.getKey(), branch, index,
                            action, definition, issues);
                        index++;
                    }
                }
            }
        }
        return List.copyOf(issues);
    }

    public void requireValid(JsonNode input) {
        var issues = validate(input);
        if (!issues.isEmpty()) throw new IllegalArgumentException(String.valueOf(issues.getFirst().get("message")));
    }

    private void validateAction(String nodeId, String branch, int index, JsonNode action,
        JsonNode definition, List<Map<String, Object>> issues) {
        String url = definition.path("url").asText();
        URI uri;
        try {
            if (!url.startsWith("/") || url.startsWith("//")) return;
            uri = URI.create("https://lingui.invalid" + url);
        } catch (IllegalArgumentException ignored) {
            return;
        }
        if (!PublicApiCatalog.isPublicPath(uri.getPath()) || uri.getRawQuery() != null) return;
        String method = definition.path("method").asText("GET").toUpperCase(Locale.ROOT);
        if (!"GET".equals(method)) return;

        Map<String, Object> contract;
        try {
            contract = contractLookup.apply(method, uri.getPath());
        } catch (RuntimeException error) {
            issue(issues, nodeId, branch, index, "无法读取公开 API 契约：" + bounded(error.getMessage(), 180));
            return;
        }
        if (contract == null || !"ok".equals(contract.get("status"))) {
            issue(issues, nodeId, branch, index, "接口「" + definition.path("name").asText()
                + "」指向当前不存在或不可解析的公开 GET API：" + uri.getPath());
            return;
        }
        validateArguments(nodeId, branch, index, action.path("args"), uri.getPath(), contract, issues);
    }

    private void validateArguments(String nodeId, String branch, int index, JsonNode args,
        String path, Map<String, Object> contract, List<Map<String, Object>> issues) {
        if (!args.isObject() || args.size() == 0) {
            checkRequired(nodeId, branch, index, Set.of(), path, contract, issues);
            return;
        }
        if (args.size() == 1 && DYNAMIC_ARGUMENTS.contains(args.fieldNames().next())) return;

        var names = new HashSet<String>();
        var required = new HashSet<String>();
        boolean complete = true;
        var parameters = contract.get("parameters");
        if (parameters instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> parameter)) continue;
                if (parameter.containsKey("$ref")) {
                    complete = false;
                    continue;
                }
                String name = String.valueOf(parameter.get("name") == null ? "" : parameter.get("name"));
                String location = String.valueOf(parameter.get("in") == null ? "" : parameter.get("in"))
                    .toLowerCase(Locale.ROOT);
                if (name.isBlank() || !(location.equals("query") || location.equals("path"))) continue;
                names.add(name);
                if (Boolean.TRUE.equals(parameter.get("required"))) required.add(name);
            }
        }
        Matcher matcher = PATH_PARAMETER.matcher(path);
        while (matcher.find()) {
            names.add(matcher.group(1));
            required.add(matcher.group(1));
        }
        var fields = args.fieldNames();
        while (complete && fields.hasNext()) {
            String field = fields.next();
            if (!names.contains(field)) issue(issues, nodeId, branch, index,
                "接口参数「" + field + "」不在当前 API 契约中，请使用 get_public_api 返回的参数名");
        }
        checkRequired(nodeId, branch, index, fieldNames(args), contract, issues, required);
    }

    private void checkRequired(String nodeId, String branch, int index, Set<String> supplied,
        String path, Map<String, Object> contract, List<Map<String, Object>> issues) {
        var required = new HashSet<String>();
        Matcher matcher = PATH_PARAMETER.matcher(path);
        while (matcher.find()) required.add(matcher.group(1));
        checkRequired(nodeId, branch, index, supplied, contract, issues, required);
    }

    private void checkRequired(String nodeId, String branch, int index, Set<String> supplied,
        Map<String, Object> contract, List<Map<String, Object>> issues, Set<String> required) {
        if (contract.get("parameters") instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> parameter) || parameter.containsKey("$ref")) continue;
                String name = String.valueOf(parameter.get("name") == null ? "" : parameter.get("name"));
                String location = String.valueOf(parameter.get("in") == null ? "" : parameter.get("in"))
                    .toLowerCase(Locale.ROOT);
                if (Boolean.TRUE.equals(parameter.get("required"))
                    && (location.equals("query") || location.equals("path")) && !name.isBlank()) required.add(name);
            }
        }
        for (String name : required) {
            if (!supplied.contains(name)) issue(issues, nodeId, branch, index,
                "接口缺少必填参数「" + name + "」，请从 API 契约中补齐 args");
        }
    }

    private static Set<String> fieldNames(JsonNode value) {
        var names = new HashSet<String>();
        value.fieldNames().forEachRemaining(names::add);
        return names;
    }

    private static void issue(List<Map<String, Object>> issues, String nodeId, String branch,
        int index, String message) {
        if (issues.size() >= 32) return;
        issues.add(Map.of("nodeId", nodeId, "branch", branch, "action", index, "message", message));
    }

    private static String bounded(String value, int max) {
        if (value == null) return "";
        return value.substring(0, Math.min(value.length(), max));
    }
}
