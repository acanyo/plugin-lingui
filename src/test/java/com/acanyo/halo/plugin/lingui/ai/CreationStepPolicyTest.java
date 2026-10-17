package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.tools.CreationStepPolicy;
import java.util.List;
import org.junit.jupiter.api.Test;
import run.halo.aifoundation.chat.StepContext;
import run.halo.aifoundation.message.ModelMessage;
import static org.assertj.core.api.Assertions.*;

class CreationStepPolicyTest {
    @Test void preservesUserAndToolMessagesAndNeverRemovesToolsDuringRepair() {
        var user = ModelMessage.user("user data");
        var tools = ModelMessage.tool(List.of());
        var original = List.of(ModelMessage.system("skill"), user, tools);
        var prepared = CreationStepPolicy.prepare(StepContext.builder().stepIndex(4).messages(original).build(), "skill");
        assertThat(prepared.getToolChoice()).isNull();
        assertThat(prepared.getActiveTools()).isNull();
        assertThat(prepared.getMessages()).hasSize(3);
        assertThat(prepared.getMessages().get(1)).isSameAs(user);
        assertThat(prepared.getMessages().get(2)).isSameAs(tools);
        assertThat(prepared.getMessages().getFirst().getContent().getFirst().getText()).contains("必须调用 validate_design");
        assertThat(original.getFirst().getContent().getFirst().getText()).isEqualTo("skill");
        var next = CreationStepPolicy.prepare(StepContext.builder().stepIndex(5).messages(prepared.getMessages()).build(), "skill");
        assertThat(next.getMessages()).hasSize(3);
        assertThat(next.getMessages().getFirst().getContent().getFirst().getText()).doesNotContain("第 5 轮");
    }
}
