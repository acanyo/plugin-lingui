package com.acanyo.halo.plugin.lingui.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import org.junit.jupiter.api.Test;

class DesignJsonParsingTest {
    private final DesignValidator validator = new DesignValidator();

    @Test
    void distinguishesDuplicateFieldsTruncationTrailingContentAndSyntaxWithoutEchoingInput() {
        var examples = java.util.Map.of(
            "{\"private-field\":1,\"private-field\":2}", "重复字段",
            "{\"private-field\":", "未完整结束",
            "{} {}", "多余内容",
            "{\n\"private-field\": \"invalid \\" + "q\"}", "语法错误");
        examples.forEach((input, issue) -> assertThatThrownBy(() -> validator.parse(input))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining(issue).hasMessageContaining("行，第")
            .hasMessageNotContaining("private-field"));
    }

    @Test
    void normalizesPlainNodesToCanonicalSourceButStillRejectsDuplicateFields() throws Exception {
        var tools = new com.acanyo.halo.plugin.lingui.ai.tools.CreationTools(
            new com.acanyo.halo.plugin.lingui.ai.tools.ComponentCatalog(),
            new com.acanyo.halo.plugin.lingui.ai.tools.SkillResources(), validator);
        var session = tools.session(null);
        var result = session.validateOutput().apply("""
            {"schemaVersion":"lingui.document/2","title":"问候","parameters":[],"state":{},
             "nodes":[{"id":"root","component":"Text","text":"你好"}]}
            """);
        validator.requireValid(validator.parse(result));
        assertThat(result).contains("root = Text(").doesNotContain("\"nodes\"");
        assertThatThrownBy(() -> session.validateOutput().apply("{\"title\":\"first\",\"title\":\"second\"}"))
            .hasMessageContaining("重复字段");
    }
}
