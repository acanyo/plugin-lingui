package com.acanyo.halo.plugin.lingui.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record AiSettings(boolean enabled, String modelName, Integer maxOutputTokens) {
    public int outputBudget() {
        return maxOutputTokens == null ? 16384 : maxOutputTokens;
    }
}
