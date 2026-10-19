package com.acanyo.halo.plugin.lingui.ai;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class AiGenerationAccessTest {
    @SuppressWarnings("unchecked")
    @Test
    void generationRoleCanReadInitialSelectionAndSanitizedModelOptionsWithoutManagingModels() {
        var roles = new ArrayList<Map<String, Object>>();
        new Yaml().loadAll(getClass().getResourceAsStream("/extensions/roles.yaml"))
            .forEach(value -> roles.add((Map<String, Object>) value));
        var role = roles.stream().filter(value -> "plugin-lingui-role-generate".equals(
            ((Map<String, Object>) value.get("metadata")).get("name"))).findFirst().orElseThrow();
        var rules = (List<Map<String, Object>>) role.get("rules");

        // Halo authorizes GETs on these collection paths using the list verb.
        assertThat(rules).anySatisfy(rule -> assertThat(rule)
            .containsEntry("apiGroups", List.of("console.api.lingui.acanyo.com"))
            .containsEntry("resources", List.of("generation-settings"))
            .containsEntry("verbs", List.of("list")));
        assertThat(rules.stream().filter(rule -> ((List<String>) rule.get("apiGroups"))
            .stream().anyMatch(group -> group.contains("aifoundation"))).toList())
            .singleElement().satisfies(rule -> assertThat(rule)
                .containsEntry("apiGroups", List.of("console.api.aifoundation.halo.run"))
                .containsEntry("resources", List.of("model-options"))
                .containsEntry("verbs", List.of("list")));
    }
}
