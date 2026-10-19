package com.acanyo.halo.plugin.lingui.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
// modelName remains readable for workbench initialization and older API clients.
public record AiSettings(boolean enabled, String modelName, Integer maxOutputTokens) {
    public int outputBudget() {
        return maxOutputTokens == null ? 16384 : maxOutputTokens;
    }
}
