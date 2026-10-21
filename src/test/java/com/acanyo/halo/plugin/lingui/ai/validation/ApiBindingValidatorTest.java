package com.acanyo.halo.plugin.lingui.ai.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ApiBindingValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DesignValidator designValidator = new DesignValidator();

    @Test
    void acceptsArgumentsThatMatchTheDiscoveredQueryContract() {
        var design = design(Map.of("page", 1, "size", 20), "/apis/api.example.test/v1alpha1/posts");
        var validator = new ApiBindingValidator((method, path) -> contract(path));

        assertThat(validator.validate(design)).isEmpty();
    }

    @Test
    void reportsUnknownAndMissingRequiredArguments() {
        var design = design(Map.of("pageSize", 20), "/apis/api.example.test/v1alpha1/posts");
        var validator = new ApiBindingValidator((method, path) -> contract(path));

        var issues = validator.validate(design);

        assertThat(issues).extracting(issue -> issue.get("message"))
            .contains("接口参数「pageSize」不在当前 API 契约中，请使用 get_public_api 返回的参数名",
                "接口缺少必填参数「page」，请从 API 契约中补齐 args");
    }

    @Test
    void rejectsAStalePublicRouteButLeavesExternalIntegrationsPortable() {
        var stale = design(Map.of(), "/apis/api.example.test/v1alpha1/removed");
        var external = design(Map.of("city", "Shanghai"), "https://api.example.com/weather");
        var validator = new ApiBindingValidator((method, path) -> Map.of(
            "status", path.endsWith("removed") ? "not_found" : "ok"));

        assertThat(validator.validate(stale)).hasSize(1);
        assertThat(validator.validate(external)).isEmpty();
    }

    private JsonNode design(Map<String, Object> args, String url) {
        var document = mapper.createObjectNode();
        document.put("schemaVersion", "lingui.document/2");
        document.put("title", "API contract");
        document.set("parameters", mapper.createArrayNode());
        document.set("state", mapper.createObjectNode());
        var nodes = mapper.createArrayNode();
        var root = mapper.createObjectNode().put("id", "root").put("component", "Column");
        root.set("children", mapper.createArrayNode().add("button"));
        nodes.add(root);
        var button = mapper.createObjectNode().put("id", "button").put("component", "Button")
            .put("child", "label");
        var action = mapper.createObjectNode().put("type", "api").put("name", "posts");
        action.set("args", mapper.valueToTree(args));
        button.set("events", mapper.createObjectNode().set("click", mapper.createObjectNode()
            .set("actions", mapper.createArrayNode().add(action))));
        nodes.add(button);
        nodes.add(mapper.createObjectNode().put("id", "label").put("component", "Text").put("text", "Load"));
        document.set("nodes", nodes);
        var integrations = mapper.createObjectNode();
        integrations.set("apis", mapper.createArrayNode().add(mapper.createObjectNode()
            .put("name", "posts").put("label", "Posts").put("method", "GET").put("url", url)));
        integrations.set("callbacks", mapper.createArrayNode());
        document.set("integrations", integrations);
        return designValidator.normalizeToolDesign(document);
    }

    private Map<String, Object> contract(String path) {
        return Map.of("status", "ok", "parameters", List.of(
            Map.of("name", "page", "in", "query", "required", true),
            Map.of("name", "size", "in", "query", "required", false)));
    }
}
