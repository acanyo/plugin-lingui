package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Schemas and all refs are bundled; generated documents can never choose a remote schema. */
final class ProtocolSchemas {
    static final ObjectMapper MAPPER = new ObjectMapper()
        .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
        .enable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final JsonSchemaFactory FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012);
    private static final JsonNode CATALOG = resource("catalog.json");
    private static final Map<String, JsonSchema> NODES = new ConcurrentHashMap<>();
    static final JsonSchema DESIGN = design();
    static final JsonSchema THEME = theme();

    static {
        MAPPER.getFactory().setStreamReadConstraints(StreamReadConstraints.builder()
            .maxNestingDepth(64).maxStringLength(524288).build());
    }

    private ProtocolSchemas() {}

    private static JsonNode resource(String name) {
        try (var stream = ProtocolSchemas.class.getResourceAsStream("/protocol/" + name)) {
            return MAPPER.readTree(stream);
        } catch (Exception error) { throw new IllegalStateException("Cannot load bundled protocol " + name, error); }
    }

    private static JsonSchema design() {
        ObjectNode schema = (ObjectNode) resource("design-envelope.schema.json");
        schema.set("$defs", CATALOG.path("$defs").deepCopy());
        return FACTORY.getSchema(schema);
    }

    private static JsonSchema theme() {
        ObjectNode schema = resource("design-envelope.schema.json").path("properties").path("theme").deepCopy();
        schema.set("$defs", CATALOG.path("$defs").deepCopy());
        return FACTORY.getSchema(schema);
    }

    static void validateNode(JsonNode node) {
        String type = node.path("component").asText();
        if (!CATALOG.path("components").has(type)) throw ValidationErrors.bad("组件不存在：" + type);
        var schema = NODES.computeIfAbsent(type, name -> {
            ObjectNode root = CATALOG.deepCopy();
            root.remove("$id");
            root.put("$ref", "#/components/" + name);
            return FACTORY.getSchema(root);
        });
        var errors = schema.validate(node);
        if (!errors.isEmpty()) throw ValidationErrors.bad("组件 " + node.path("id").asText()
            + "（" + type + "）：" + errors.iterator().next().getMessage());
    }
}
