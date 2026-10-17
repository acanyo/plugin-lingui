package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Set;
import java.util.regex.Pattern;

/** Checks portable event configuration without requesting URLs or executing callbacks. */
final class EventComponentValidator {
    private static final Set<String> REFERENCES = Set.of("$state", "$event", "$result", "$error");
    private static final Pattern PRIVATE_HEADER = Pattern.compile(
        "^(authorization|proxy-authorization|cookie|set-cookie|host|origin|referer|sec-|x-halo-)", Pattern.CASE_INSENSITIVE);
    private EventComponentValidator() {}

    static void validate(JsonNode node) {
        node.path("events").forEach(binding -> {
            for (String key : new String[]{"loadingPath", "errorPath", "resultPath"}) output(binding, key);
            for (String branch : new String[]{"actions", "onSuccess", "onError"}) binding.path(branch).forEach(EventComponentValidator::action);
        });
    }
    private static void action(JsonNode action) {
        output(action, "resultPath");
        switch (action.path("type").asText()) {
            case "request" -> {
                url(action.path("url").asText());
                if (action.path("method").asText("GET").equals("GET") && action.has("body")) throw bad("GET 请求请使用查询参数");
                action.path("headers").fields().forEachRemaining(header -> {
                    if (PRIVATE_HEADER.matcher(header.getKey()).find()) throw bad("认证信息由宿主提供，请勿写入作品");
                });
                for (String key : new String[]{"query", "headers", "body"}) parameters(action.path(key));
            }
            case "callback", "api" -> parameters(action.path("args"));
            case "emit" -> parameters(action.path("detail"));
            case "local" -> action.path("actions").forEach(item -> {
                String type = item.path("type").asText();
                if (!type.equals("reset") && (!item.has("path") || InstanceValidator.segments(item.path("path").asText()).length == 0)) throw bad("事件动作缺少有效状态路径");
                if (Set.of("setState", "selectOption").contains(type) && !item.has("value")) throw bad("事件动作缺少值");
                parameters(item.path("value"));
            });
            default -> { /* Action kinds and bounds are constrained by the pinned schema. */ }
        }
    }
    private static void output(JsonNode node, String key) {
        if (node.has(key) && InstanceValidator.segments(node.path(key).asText()).length == 0) throw bad("事件状态路径不能是根节点");
    }
    private static void parameters(JsonNode value) {
        if (value.isObject() && value.size() == 1 && REFERENCES.contains(value.fieldNames().next())) {
            var path = value.elements().next();
            if (!path.isTextual()) throw bad("事件参数引用需要有效状态路径");
            InstanceValidator.segments(path.asText());
        } else if (value.isContainerNode()) value.forEach(EventComponentValidator::parameters);
    }
    static void url(String value) {
        if (value.isEmpty() || value.startsWith("//") || value.matches("(?s).*[\\x00-\\x20\\\\].*")) throw bad("API 地址格式无效");
        try {
            // Relative URLs are resolved by the embedding page; no server-side network calls.
            URI uri = URI.create("https://localhost/").resolve(value);
            String scheme = uri.getScheme();
            if (uri.getRawUserInfo() != null || uri.getRawFragment() != null || uri.getHost() == null
                || !("https".equalsIgnoreCase(scheme) || ("http".equalsIgnoreCase(scheme)
                    && Set.of("localhost", "127.0.0.1", "[::1]").contains(uri.getHost().toLowerCase())))) throw bad("API 请使用 HTTPS、站内地址或本地开发地址");
        } catch (IllegalArgumentException exception) { throw bad("API 地址格式无效"); }
    }
}
