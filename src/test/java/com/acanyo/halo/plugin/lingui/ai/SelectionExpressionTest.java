package com.acanyo.halo.plugin.lingui.ai;

import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class SelectionExpressionTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final DesignValidator validator = new DesignValidator();

    private com.fasterxml.jackson.databind.JsonNode design(String expression, boolean computed) {
        String source = "root = Column({\"id\":\"root\",\"children\":[\"picker\",\"result\"]}, [picker, result])\n"
            + "picker = ChoicePicker({\"id\":\"picker\",\"label\":\"选择答案\",\"value\":{\"path\":\"/answer\"},\"options\":[{\"label\":\"堆\",\"value\":\"heap\"}],\"variant\":\"mutuallyExclusive\"}, [])\n"
            + (computed
                ? "result = Text({\"id\":\"result\",\"text\":{\"call\":\"lingui.evaluate\",\"args\":{\"expression\":" + expression + "}}}, [])"
                : "result = LingUI_Conditional({\"id\":\"result\",\"condition\":" + expression + ",\"child\":\"label\"}, [label])\nlabel = Text({\"id\":\"label\",\"text\":\"解析\"}, [])");
        return mapper.valueToTree(Map.of("schemaVersion", "lingui.document/2", "title", "测验",
            "parameters", List.of(), "state", Map.of("answer", List.of()), "source", source));
    }

    @Test void rejectsArrayToScalarEqualityInEitherDirectionAndInNestedScores() {
        for (String operator : List.of("eq", "neq")) {
            String comparison = "{\"op\":\"" + operator + "\",\"args\":[{\"path\":\"/answer\"},\"heap\"]}";
            assertThatThrownBy(() -> validator.requireValid(design(comparison, false))).hasMessageContaining("includes");
            String reversed = "{\"op\":\"" + operator + "\",\"args\":[\"heap\",{\"path\":\"/answer\"}]}";
            assertThatThrownBy(() -> validator.requireValid(design(reversed, false))).hasMessageContaining("includes");
            String nested = "{\"op\":\"if\",\"args\":[" + comparison + ",\"正确\",\"错误\"]}";
            assertThatThrownBy(() -> validator.requireValid(design(nested, true))).hasMessageContaining("includes");
        }
    }

    @Test void acceptsArrayMembershipInConditionsAndComputedValues() {
        String membership = "{\"op\":\"includes\",\"args\":[{\"path\":\"/answer\"},\"heap\"]}";
        validator.requireValid(design(membership, false));
        validator.requireValid(design("{\"op\":\"if\",\"args\":[" + membership + ",\"正确\",\"错误\"]}", true));
    }
}
