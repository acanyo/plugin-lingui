package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashSet;

/** Cross-property checks shared with the workbench catalog's analytical components. */
final class AdvancedComponentValidator {
    private AdvancedComponentValidator() {}
    static void validate(JsonNode node) {
        String type = node.path("component").asText();
        if (type.equals("LingUI.Gauge") && node.path("min").asDouble() >= node.path("max").asDouble()) throw bad("仪表盘最大值必须大于最小值");
        if (type.equals("LingUI.RadarChart")) {
            for (var item : node.path("data")) if (item.path("value").asDouble() > node.path("max").asDouble()) throw bad("雷达数值不能超过刻度上限");
        }
        if (type.equals("LingUI.Heatmap")) {
            for (var row : node.path("matrix")) if (row.path("cells").size() != node.path("columns").size()) throw bad("热力表列数不一致");
        }
        var children = new HashSet<String>();
        for (var section : node.path("sections")) if (!children.add(section.path("child").asText())) throw bad("手风琴内容引用不能重复");
    }
}
