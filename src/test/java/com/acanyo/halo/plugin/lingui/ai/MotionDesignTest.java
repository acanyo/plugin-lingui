package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog;
import com.acanyo.halo.plugin.lingui.ai.tools.SkillResources;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class MotionDesignTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DesignValidator validator = new DesignValidator();

    private ObjectNode example() throws Exception {
        try (var stream = getClass().getResourceAsStream("/skills/lingui-create/examples/motion.json")) {
            return (ObjectNode) mapper.readTree(stream);
        }
    }

    @Test void acceptsMotionThroughTheSameToolNormalizationAndValidationAsAiGeneration() throws Exception {
        var design = validator.normalizeToolDesign(example());
        assertThatCode(() -> validator.requireValid(design)).doesNotThrowAnyException();
        assertThat(design.path("document").path("source").asText()).contains("\"motion\"", "\"transition\"");
        var catalog = new ComponentCatalog().schemas(List.of("Card", "LingUI.Collapse"));
        assertThat(catalog.path("$defs").has("appearanceMotion")).isTrue();
        assertThat(new SkillResources().get("motion")).contains("prefers-reduced-motion", "scale-down");
    }

    @Test void rejectsUnboundedTimingAndExecutableAnimationFields() throws Exception {
        for (String value : List.of(
            "{\"enter\":{\"preset\":\"fade\",\"duration\":2001}}",
            "{\"hover\":{\"preset\":\"lift\",\"keyframes\":[]}}",
            "{\"transition\":{\"duration\":200}}")) {
            var design = example();
            ((ObjectNode) design.path("document").path("nodes").get(0)).set("motion", mapper.readTree(value));
            assertThatThrownBy(() -> validator.normalizeToolDesign(design)).isInstanceOf(IllegalArgumentException.class);
        }
    }
}
