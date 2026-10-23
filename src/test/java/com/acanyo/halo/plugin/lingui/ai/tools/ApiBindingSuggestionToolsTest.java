package com.acanyo.halo.plugin.lingui.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ApiBindingSuggestionToolsTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @SuppressWarnings("unchecked")
    void suggestsListTableAndChartBindingsFromAResponseExample() {
        JsonNode input = mapper.createObjectNode()
            .set("contract", mapper.createObjectNode().set("responseExample", mapper.createObjectNode()
                .set("items", mapper.createArrayNode().add(mapper.createObjectNode()
                    .put("id", "post-1").put("name", "Spring Flux").put("summary", "A post")
                    .put("views", 128)))));

        var result = ApiBindingSuggestionTools.suggest(input);
        var suggestions = (List<Map<String, Object>>) result.get("suggestions");

        assertThat(result).as(result.toString()).containsEntry("status", "ok");
        assertThat(suggestions).extracting(item -> item.get("component"))
            .contains("List", "LingUI.Table", "LingUI.BarChart", "LingUI.LineChart");
        var list = suggestions.stream().filter(item -> item.get("component").equals("List")).findFirst().orElseThrow();
        assertThat(list).containsEntry("responsePath", "/response");
        assertThat(list.toString()).contains("/response/items", "/name", "/summary");
    }

    @Test
    void resolvesAResponseSchemaWhenNoExampleIsAvailable() {
        ObjectNode itemProperties = mapper.createObjectNode();
        itemProperties.set("title", mapper.createObjectNode().put("type", "string"));
        itemProperties.set("views", mapper.createObjectNode().put("type", "integer"));
        var itemSchema = mapper.createObjectNode().put("type", "object");
        itemSchema.set("properties", itemProperties);
        var arraySchema = mapper.createObjectNode().put("type", "array");
        arraySchema.set("items", itemSchema);
        var schema = mapper.createObjectNode().put("type", "object");
        schema.set("properties", mapper.createObjectNode().set("items", arraySchema));
        var media = mapper.createObjectNode().set("schema", schema);
        var content = mapper.createObjectNode().set("application/json", media);
        var response = mapper.createObjectNode().set("content", content);
        var responses = mapper.createObjectNode().set("200", response);
        var contract = mapper.createObjectNode().set("responses", responses);
        ObjectNode input = mapper.createObjectNode();
        input.set("contract", contract);
        input.set("components", mapper.createArrayNode().add("LingUI.BarChart"));

        var result = ApiBindingSuggestionTools.suggest(input);

        assertThat(result).containsEntry("status", "ok");
        assertThat(result.toString()).contains("LingUI.BarChart", "/response/items", "/views");
    }

    @Test
    void returnsAnActionableWarningWhenTheContractHasNoResponseShape() {
        var result = ApiBindingSuggestionTools.suggest(mapper.createObjectNode()
            .set("contract", mapper.createObjectNode()));

        assertThat(result).containsEntry("status", "insufficient_data");
        assertThat(result.toString()).contains("responseExample", "响应 schema");
    }
}
