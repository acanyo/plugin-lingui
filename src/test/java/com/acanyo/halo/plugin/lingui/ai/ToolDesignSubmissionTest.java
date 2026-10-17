package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.tools.*;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import run.halo.aifoundation.tool.ToolExecutionContext;
import static org.assertj.core.api.Assertions.*;

class ToolDesignSubmissionTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DesignValidator validator = new DesignValidator();
    private final CreationTools tools = new CreationTools(new ComponentCatalog(), new SkillResources(), validator);
    ToolDesignSubmissionTest() throws Exception {}
    private Map<String, Object> design() {
        return Map.of("schemaVersion", "lingui.document/2", "title", "交互作品", "parameters", List.of(),
            "nodes", List.of(Map.of("id", "root", "component", "Text", "text", "内容")), "state", Map.of());
    }
    private Object validate(com.acanyo.halo.plugin.lingui.ai.tools.CreationSession session, Map<String,Object> arguments) {
        return session.tools().stream().filter(t -> t.getName().equals("validate_design")).findFirst().orElseThrow()
            .getExecutor().execute(ToolExecutionContext.builder().input(arguments).build()).block();
    }
    @Test void preflightDoesNotFinalizeAndFinalSubmissionReturnsOnlyStandardSource() {
        var session = tools.session(null);
        validate(session, Map.of("design", Map.of("document", design())));
        assertThat(session.complete()).isFalse();
        validate(session, Map.of("design", Map.of("document", design()), "finalize", true));
        assertThat(session.complete()).isTrue();
        var output = validator.parse(session.output());
        assertThat(output.path("document").has("nodes")).isFalse();
        assertThat(output.path("document").path("source").asText()).contains("root = Text(");
        validator.requireValid(output);
    }
    @Test void cannotFinalizeAGreetingWhenTheRequestRequiresAnApi() {
        var session = tools.session(null, "基于 https://api.example.com/weather?city=beijing 这个接口展示天气");
        var result = mapper.valueToTree(validate(session, Map.of("design", design(), "finalize", true)));
        assertThat(session.complete()).isFalse();
        assertThat(result.path("valid").asBoolean()).isFalse();
        assertThat(result.path("issues").toString()).contains("实际请求动作");
    }
    @Test void rejectsMixedSourceAndNodesAndInvalidReferencesWithoutChangingTheSession() {
        var mixed = new java.util.HashMap<>(design()); mixed.put("source", "root = Text({}, [])");
        var session = tools.session(null);
        assertThat(mapper.valueToTree(validate(session, Map.of("design", mixed, "finalize", true))).path("isError").asBoolean()).isTrue();
        var dangling = new java.util.HashMap<>(design());
        dangling.put("nodes", List.of(Map.of("id", "root", "component", "Column", "children", List.of("missing"))));
        var result = mapper.valueToTree(validate(session, Map.of("design", dangling, "finalize", true)));
        assertThat(result.path("valid").asBoolean()).isFalse();
        assertThat(session.complete()).isFalse();
    }

    @Test void acceptsTheSuppliedApiWithEncodedOrActionQueryParameters() {
        for (String url : List.of("https://api.example.com/weather?timezone=Asia%2FShanghai", "https://api.example.com/weather")) {
            var session = tools.session(null, "基于 https://api.example.com/weather?timezone=Asia/Shanghai 接口展示天气");
            var document = new java.util.HashMap<>(design());
            document.put("nodes", List.of(
                Map.of("id", "root", "component", "Button", "child", "label", "events", Map.of("click", Map.of("actions", List.of(
                    Map.of("type", "api", "name", "weather", "args", Map.of("timezone", "Asia/Shanghai")))))),
                Map.of("id", "label", "component", "Text", "text", "获取天气")));
            document.put("integrations", Map.of("apis", List.of(Map.of("name", "weather", "label", "天气", "method", "GET", "url", url)), "callbacks", List.of()));
            validate(session, Map.of("design", document, "finalize", true));
            assertThat(session.complete()).isTrue();
        }
    }

    @Test void acceptsAutomaticApiLoadingOnAContainerWithoutARefreshButton() {
        var session = tools.session(null, "基于 https://api.example.com/weather 接口，打开时展示天气，不需要刷新按钮");
        var document = new java.util.HashMap<>(design());
        document.put("nodes", List.of(
            Map.of("id", "root", "component", "Column", "children", List.of("summary"),
                "events", Map.of("mount", Map.of("actions", List.of(Map.of("type", "api", "name", "weather")),
                    "resultPath", "/response", "loadingPath", "/loading", "errorPath", "/error"))),
            Map.of("id", "summary", "component", "Text", "text", Map.of("path", "/response/summary"))));
        document.put("state", Map.of("response", Map.of("summary", ""), "loading", false, "error", ""));
        document.put("integrations", Map.of("apis", List.of(Map.of("name", "weather", "label", "天气",
            "method", "GET", "url", "https://api.example.com/weather")), "callbacks", List.of()));
        var result = mapper.valueToTree(validate(session, Map.of("design", document, "finalize", true)));
        assertThat(session.complete()).withFailMessage(result.toPrettyString()).isTrue();
        var output = validator.parse(session.output());
        validator.requireValid(output);
        var finalDocument = output.has("schemaVersion") ? output : output.path("document");
        assertThat(finalDocument.path("source").asText()).contains("\"mount\"").doesNotContain("Button(");
    }
}
