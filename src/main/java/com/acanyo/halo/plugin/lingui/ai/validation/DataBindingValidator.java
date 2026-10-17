package com.acanyo.halo.plugin.lingui.ai.validation;

import com.fasterxml.jackson.databind.JsonNode;

/** Collection mappings reference state and relative record paths; component schemas constrain fields. */
final class DataBindingValidator {
    private DataBindingValidator() {}
    static void validate(JsonNode node) {
        node.path("bindings").forEach(binding -> {
            InstanceValidator.segments(binding.path("path").asText());
            binding.path("map").forEach(mapping -> {
                if (mapping.isArray()) mapping.forEach(path -> InstanceValidator.segments(path.asText()));
                else InstanceValidator.segments(mapping.asText());
            });
        });
        for (String name : new String[]{"loading", "error"}) {
            var binding = node.path("dataState").path(name);
            if (!binding.isMissingNode()) InstanceValidator.segments(binding.path("path").asText());
        }
    }
}
