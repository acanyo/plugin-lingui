package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.Set;

/** Read-time migration of Lingui's legacy catalog snapshots. Never rewrites stored history. */
public final class SavedDocumentNormalizer {
    private SavedDocumentNormalizer() {}
    public static JsonNode normalize(JsonNode input, DesignValidator validator) {
        if (!"lingui.document/1".equals(input.path("schemaVersion").asText())) return input.deepCopy();
        String resave = "旧作品包含需要转换的协议，请在工作台打开并保存后再通过 MCP 读取";
        input.fieldNames().forEachRemaining(key -> {
            if (!Set.of("schemaVersion", "title", "parameters", "messages").contains(key))
                throw new IllegalArgumentException(resave);
        });
        var messages = input.path("messages");
        if (!messages.isArray() || messages.size() > 64) throw new IllegalArgumentException(resave);
        String surface = null;
        var nodes = new LinkedHashMap<String, JsonNode>();
        JsonNode state = ProtocolSchemas.MAPPER.createObjectNode();
        for (var message : messages) {
            if (!Set.of("v0.9", "v0.9.1").contains(message.path("version").asText()) || message.size() != 2)
                throw new IllegalArgumentException(resave);
            if (message.has("createSurface")) {
                var create = message.path("createSurface");
                if (surface != null || !"urn:lingui:catalog:1".equals(create.path("catalogId").asText())
                    || create.path("sendDataModel").asBoolean() || create.has("theme")
                    || !create.path("surfaceId").isTextual()) throw new IllegalArgumentException(resave);
                surface = create.path("surfaceId").asText();
            } else if (message.has("updateComponents")) {
                var update = message.path("updateComponents");
                if (surface == null || !surface.equals(update.path("surfaceId").asText())
                    || !update.path("components").isArray()) throw new IllegalArgumentException(resave);
                var seen = new java.util.HashSet<String>();
                for (var node : update.path("components")) {
                    String id = node.path("id").asText();
                    if (!seen.add(id)) throw new IllegalArgumentException(resave);
                    nodes.put(id, node.deepCopy());
                }
            } else if (message.has("updateDataModel")) {
                var update = message.path("updateDataModel");
                if (surface == null || !surface.equals(update.path("surfaceId").asText()) || !update.has("value"))
                    throw new IllegalArgumentException(resave);
                String path = update.path("path").asText("");
                if (path.isEmpty() || path.equals("/")) {
                    if (!update.path("value").isObject()) throw new IllegalArgumentException(resave);
                    state = update.path("value").deepCopy();
                } else InstanceValidator.write(state, path, update.path("value").deepCopy());
            } else throw new IllegalArgumentException(resave);
            if (nodes.size() > 256) throw new IllegalArgumentException(resave);
        }
        ObjectNode document = ProtocolSchemas.MAPPER.createObjectNode();
        document.put("schemaVersion", "lingui.document/2");
        document.set("title", input.path("title"));
        document.set("parameters", input.path("parameters"));
        document.set("state", state);
        document.set("nodes", ProtocolSchemas.MAPPER.valueToTree(nodes.values()));
        var normalized = validator.normalizeToolDesign(document);
        validator.requireValid(normalized);
        return normalized;
    }
}
