package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import com.acanyo.halo.plugin.lingui.ai.tools.SkillResources;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import run.halo.aifoundation.tool.ToolExecutionContext;
import static org.assertj.core.api.Assertions.*;

class CreationToolsTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final ComponentCatalog catalog = new ComponentCatalog();
    private final DesignValidator validator = new DesignValidator();
    private final CreationTools tools = new CreationTools(catalog, new SkillResources(), validator);

    CreationToolsTest() throws Exception {}

    @Test void bundledExamplesPassTheSharedServerContractAndGuidanceIsAvailableToTools() throws Exception {
        for (String name : List.of("api-retry", "quiz", "metrics", "host-callback")) {
            try (var stream = getClass().getClassLoader().getResourceAsStream("skills/lingui-create/examples/" + name + ".json")) {
                assertThat(stream).isNotNull();
                var normalized = validator.normalizeToolDesign(mapper.readTree(stream));
                assertThatCode(() -> validator.requireValid(normalized)).doesNotThrowAnyException();
            }
        }
        for (String topic : List.of("layout", "examples", "callbacks")) {
            var result = mapper.valueToTree(tools.call("get_guidance", Map.of("topic", topic), new CreationTools.WorkContext(null, null)).block());
            assertThat(result.path("isError").asBoolean()).isFalse();
            assertThat(result.path("text").asText()).isNotBlank();
        }
    }

    @Test void searchesEveryComponentAndProvidesCompleteLocalSchemaReferences() throws Exception {
        var names = new HashSet<String>();
        for (int offset = 0; offset < 105; offset += 20) {
            var page = mapper.valueToTree(catalog.search("", offset, 20));
            for (var item : page.path("items")) names.add(item.path("name").asText());
        }
        assertThat(names).hasSize(105);
        assertThat(mapper.valueToTree(catalog.search("颜色", 0, 20)).toString()).contains("LingUI.ColorPicker");
        for (String name : names) {
            var schema = catalog.schemas(List.of(name));
            checkRefs(schema, schema);
            assertThat(schema.path("components").has(name)).isTrue();
        }
        assertThat(catalog.schemas(List.of("Text")).toString().length()).isLessThan(25000);
        var documentSchema = catalog.schemas(List.of("Text")).path("documentSchema");
        assertThat(documentSchema.path("additionalProperties").asBoolean(true)).isFalse();
        assertThat(documentSchema.path("properties").has("integrations")).isTrue();
        assertThat(documentSchema.path("properties").has("publicEmbed")).isFalse();
        assertThatThrownBy(() -> catalog.schemas(List.of("MadeUp"))).hasMessageContaining("不存在");
    }

    private void checkRefs(JsonNode node, JsonNode root) {
        if (node.has("$ref")) assertThat(root.at(node.path("$ref").asText().substring(1)).isMissingNode())
            .as(node.path("$ref").asText()).isFalse();
        if (node.isContainerNode()) node.forEach(child -> checkRefs(child, root));
    }

    @Test void keepsSnapshotsAndCallBudgetsIsolatedBetweenRequests() {
        var first = tools.forGeneration("{\"title\":\"first\"}");
        var second = tools.forGeneration("{\"title\":\"second\"}");
        var call = ToolExecutionContext.builder().input(Map.of()).build();
        var getFirst = first.stream().filter(tool -> tool.getName().equals("get_current_work")).findFirst().orElseThrow();
        var getSecond = second.stream().filter(tool -> tool.getName().equals("get_current_work")).findFirst().orElseThrow();
        assertThat(getFirst.getExecutor().execute(call).block().toString()).contains("first").doesNotContain("second");
        for (int i = 0; i < 18; i++) getFirst.getExecutor().execute(call).block();
        assertThat(getFirst.getExecutor().execute(call).block().toString()).contains("已达上限");
        assertThat(getSecond.getExecutor().execute(call).block().toString()).contains("second");
        assertThat(tools.call("get_current_work", Map.of(), new CreationTools.WorkContext(null, null)).block().toString())
            .contains("empty");
    }

    @Test void returnsKnownSchemasWhenOneNameIsWrongAndResolvesUnambiguousPrefixes() {
        var response = catalog.schemas(List.of("Metric", "LingUI_Text", "ImaginaryWeather"));
        assertThat(response.path("components").has("LingUI.Metric")).isTrue();
        assertThat(response.path("components").has("Text")).isTrue();
        assertThat(response.path("unknownComponents").toString()).contains("ImaginaryWeather");
        checkRefs(response, response);
        assertThat(mapper.valueToTree(catalog.search("天气WeatherImaginary", 0, 20)).path("hint").asText())
            .contains("基础 UI");
    }

    @Test void returnsActionableArgumentErrorsAndNeverExecutesSuppliedCode() {
        var context = new CreationTools.WorkContext(null, null);
        assertThat(tools.call("get_component_schemas", Map.of("names", List.of("Button"), "url", "https://example.org"), context)
            .block().toString()).contains("isError=true");
        assertThat(tools.call("get_guidance", Map.of("topic", "../../secret"), context).block().toString()).contains("isError=true");
    }

    @Test void onlyAcceptsTheFinalValidatedDesignWithinItsOwnSession() {
        var session = tools.session(null);
        var other = tools.session(null);
        var validate = session.tools().stream().filter(tool -> tool.getName().equals("validate_design"))
            .findFirst().orElseThrow().getExecutor();
        validate.execute(ToolExecutionContext.builder().input(Map.of("design", Map.of())).build()).block();
        assertThat(session.complete()).isFalse();
        var design = Map.of("schemaVersion", "lingui.document/2", "title", "问候", "parameters", List.of(),
            "source", "root = Text({\"id\":\"root\",\"text\":\"你好\"}, [])", "state", Map.of());
        validate.execute(ToolExecutionContext.builder().input(Map.of("design", design, "finalize", true)).build()).block();
        assertThat(session.complete()).isTrue();
        assertThat(session.output()).contains("你好");
        assertThat(other.complete()).isFalse();
    }

    @Test void acceptsBundledExampleAndRejectsInvalidPropertiesReferencesAndThemes() throws Exception {
        JsonNode document;
        try (var stream = getClass().getResourceAsStream("/protocol/generation-example.json")) {
            document = mapper.readTree(stream);
        }
        assertThat(mapper.valueToTree(validator.validate(document)).path("valid").asBoolean()).isTrue();
        ObjectNode changed = document.deepCopy();
        changed.put("source", "root = Text({\"id\":\"root\",\"text\":\"Hi\",\"madeUp\":true}, [])");
        assertThat(mapper.valueToTree(validator.validate(changed)).path("valid").asBoolean()).isFalse();
        changed.put("source", "root = Column({\"id\":\"root\",\"children\":[\"missing\"]}, [missing])");
        assertThat(mapper.valueToTree(validator.validate(changed)).toString()).contains("引用不存在");
        var design = mapper.createObjectNode(); design.set("document", document); design.set("theme", mapper.createObjectNode().put("radius", 100));
        assertThat(mapper.valueToTree(validator.validate(design)).path("valid").asBoolean()).isFalse();
        assertThatThrownBy(() -> validator.parse("{\"a\":1,\"a\":2}")).hasMessageContaining("重复字段");
    }
}
