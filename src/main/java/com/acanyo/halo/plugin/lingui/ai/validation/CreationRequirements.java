package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Checks the API supplied by this request without fetching it or inferring business data. */
public final class CreationRequirements {
    private static final Pattern URL = Pattern.compile("https?://[^\\s<>\"'）），。；、]+");
    private final Set<String> suppliedApis;

    public CreationRequirements(String instruction) {
        String current = instruction == null ? "" : instruction;
        int latest = current.lastIndexOf("\n本次要求：\n");
        if (latest >= 0) current = current.substring(latest + "\n本次要求：\n".length());
        suppliedApis = new HashSet<>();
        if (!Pattern.compile("(?i)(接口|\\bapi\\b)").matcher(current).find()
            || Pattern.compile("(?:不要|取消|去掉|移除).{0,8}(?:接口|API)").matcher(current).find()) return;
        var matches = URL.matcher(current);
        while (matches.find()) suppliedApis.add(matches.group());
    }

    public void requireValid(JsonNode input) {
        if (suppliedApis.isEmpty()) return;
        var document = input.has("schemaVersion") ? input : input.path("document");
        var apis = new java.util.HashMap<String, String>();
        for (var api : document.path("integrations").path("apis"))
            apis.put(api.path("name").asText(), api.path("url").asText());
        for (var node : OpenuiSource.parse(document.path("source").asText()).values())
            for (var binding : node.path("events"))
                for (String branch : List.of("actions", "onSuccess", "onError"))
                    for (var action : binding.path(branch)) {
                        if (action.path("type").asText().equals("api") && matches(apis.get(action.path("name").asText()), action.path("args"))) return;
                        if (action.path("type").asText().equals("request") && matches(action.path("url").asText(), action.path("query"))) return;
                    }
        throw new IllegalArgumentException("本次要求使用用户提供的接口，但设计未绑定该地址的实际请求动作。请保留接口、自动加载或手动获取事件以及响应展示；不能用测试或问候文档代替完整作品");
    }

    private boolean matches(String configured, JsonNode args) {
        if (configured == null) return false;
        try {
            var actual = java.net.URI.create(configured).normalize();
            var query = query(actual.getRawQuery());
            args.fields().forEachRemaining(entry -> {
                if (entry.getValue().isValueNode()) query.put(entry.getKey(), entry.getValue().asText());
            });
            for (String supplied : suppliedApis) {
                var expected = java.net.URI.create(supplied).normalize();
                if (java.util.Objects.equals(expected.getScheme(), actual.getScheme())
                    && java.util.Objects.equals(expected.getHost(), actual.getHost())
                    && expected.getPort() == actual.getPort()
                    && java.util.Objects.equals(expected.getPath(), actual.getPath())
                    && query.entrySet().containsAll(query(expected.getRawQuery()).entrySet())) return true;
            }
        } catch (IllegalArgumentException ignored) { /* Normal design validation reports invalid URLs. */ }
        return false;
    }

    private java.util.Map<String, String> query(String value) {
        var result = new java.util.HashMap<String, String>();
        if (value == null) return result;
        for (String entry : value.split("&")) {
            var pair = entry.split("=", 2);
            result.put(java.net.URLDecoder.decode(pair[0], java.nio.charset.StandardCharsets.UTF_8),
                java.net.URLDecoder.decode(pair.length > 1 ? pair[1] : "", java.nio.charset.StandardCharsets.UTF_8));
        }
        return result;
    }
}
