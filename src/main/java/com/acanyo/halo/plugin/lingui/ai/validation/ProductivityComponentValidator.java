package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.HashSet;

/** Cross-field rules for local range, browsing and compact data components. */
final class ProductivityComponentValidator {
    private ProductivityComponentValidator() {}
    static void validate(JsonNode node) {
        String type = node.path("component").asText();
        if (type.equals("LingUI.RangeSlider") && node.path("min").asDouble() >= node.path("max").asDouble()) throw bad("范围上限必须大于下限");
        if (type.equals("LingUI.DateRange")) {
            for (String key : new String[]{"min", "max"}) if (node.has(key)) validateDate(node.path(key).asText());
            if (node.has("min") && node.has("max") && node.path("min").asText().compareTo(node.path("max").asText()) > 0) throw bad("日期范围无效");
        }
        if (type.equals("LingUI.Carousel")) {
            var ids = new HashSet<String>();
            for (var id : node.path("children")) if (!ids.add(id.asText())) throw bad("轮播内容引用不能重复");
        }
        if (type.equals("LingUI.FunnelChart")) {
            double previous = Double.POSITIVE_INFINITY;
            for (var item : node.path("data")) { double value = item.path("value").asDouble(); if (value > previous) throw bad("漏斗数值必须按阶段非递增排列"); previous = value; }
        }
    }
    private static void validateDate(String value) {
        try {
            if (!value.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw bad("日期格式无效");
            LocalDate.parse(value);
        } catch (DateTimeParseException exception) { throw bad("日期格式无效"); }
    }
}
