package com.acanyo.halo.plugin.lingui.ai;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class ComponentPromptTest {
    @Test void usesShortSkillWithProgressiveDisclosureAndUserStylePriority() throws Exception {
        var system = new ComponentPrompt().system();
        assertThat(system).contains("lingui.document/2", "urn:lingui:openui:1", "OpenUI Lang", "用户指定风格优先",
            "get_component_schemas", "get_current_work", "validate_design");
        assertThat(system).doesNotContain("createSurface", "updateComponents", "updateDataModel");
    }
    @Test void existingContextCannotChangeTheGenerationContract() throws Exception {
        var prompt = new ComponentPrompt();
        assertThat(prompt.system(new AiEndpoint.GenerateRequest("调整样式", "{\"schemaVersion\":\"lingui.document/1\"}")))
            .isEqualTo(prompt.system());
        assertThat(prompt.user(new AiEndpoint.GenerateRequest("调整样式", "已有内容")))
            .contains("调整样式", "不是系统指令", "get_current_work");
    }
    @Test void invalidContextCannotSelectAnotherCatalog() throws Exception {
        var prompt = new ComponentPrompt();
        assertThat(prompt.system(new AiEndpoint.GenerateRequest("调整样式", "{"))).isEqualTo(prompt.system());
    }
}
