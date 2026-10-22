package com.acanyo.halo.plugin.lingui.ai.validation;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RuntimePreflightValidatorTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DesignValidator designValidator = new DesignValidator();
    private final RuntimePreflightValidator validator = new RuntimePreflightValidator();

    @Test
    void replaysAResponseExampleIntoCollectionBindingsWithoutNetworkAccess() {
        var design = design("/name", "/summary", true);

        var report = validator.inspect(design);

        assertThat(report.checkedApis()).isEqualTo(1);
        assertThat(report.checkedBindings()).isEqualTo(1);
        assertThat(report.issues()).isEmpty();
    }

    @Test
    void reportsMissingMappedFieldsAndResultPaths() {
        var missingField = validator.inspect(design("/title", "/summary", true));
        var missingResultPath = validator.inspect(design("/name", "/summary", false));

        assertThat(missingField.issues()).extracting(issue -> issue.get("message"))
            .contains("数据绑定 /response/items 的字段路径 /title 不在示例响应中");
        assertThat(missingResultPath.issues()).extracting(issue -> issue.get("message"))
            .contains("接口示例响应没有 resultPath，无法注入状态并验证组件绑定");
    }

    private JsonNode design(String labelPath, String descriptionPath, boolean resultPath) {
        var document = mapper.createObjectNode();
        document.put("schemaVersion", "lingui.document/2");
        document.put("title", "Runtime preflight");
        document.set("parameters", mapper.createArrayNode());
        document.set("state", mapper.createObjectNode().set("response",
            mapper.createObjectNode().set("items", mapper.createArrayNode())));

        var nodes = mapper.createArrayNode();
        var root = mapper.createObjectNode().put("id", "root").put("component", "Column");
        root.set("children", mapper.createArrayNode().add("load").add("results"));
        nodes.add(root);
        var load = mapper.createObjectNode().put("id", "load").put("component", "Button")
            .put("child", "load-label");
        var action = mapper.createObjectNode().put("type", "api").put("name", "posts");
        ObjectNode event = mapper.createObjectNode();
        event.set("actions", mapper.createArrayNode().add(action));
        if (resultPath) event.put("resultPath", "/response");
        load.set("events", mapper.createObjectNode().set("click", event));
        nodes.add(load);
        nodes.add(mapper.createObjectNode().put("id", "load-label").put("component", "Text")
            .put("text", "Load"));
        var results = mapper.createObjectNode().put("id", "results").put("component", "List");
        results.set("children", mapper.createArrayNode());
        results.set("items", mapper.createArrayNode());
        results.set("bindings", mapper.createObjectNode().set("items", mapper.createObjectNode()
            .put("path", "/response/items")
            .set("map", mapper.createObjectNode().put("label", labelPath).put("description", descriptionPath))));
        nodes.add(results);
        document.set("nodes", nodes);

        var integrations = mapper.createObjectNode();
        integrations.set("apis", mapper.createArrayNode().add(mapper.createObjectNode()
            .put("name", "posts").put("label", "Posts").put("method", "GET")
            .put("url", "/apis/api.example.test/v1alpha1/posts")
            .set("responseExample", mapper.createObjectNode().set("items", mapper.createArrayNode().add(
                mapper.createObjectNode().put("name", "Spring Flux").put("summary", "A post"))))));
        integrations.set("callbacks", mapper.createArrayNode());
        document.set("integrations", integrations);
        return designValidator.normalizeToolDesign(document);
    }
}
