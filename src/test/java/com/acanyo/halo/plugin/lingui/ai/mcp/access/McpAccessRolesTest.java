package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class McpAccessRolesTest {
    @SuppressWarnings("unchecked")
    @Test void anonymousGrantExposesOnlyTheCustomAuthenticatedMcpPost() {
        var documents = new ArrayList<Map<String, Object>>();
        new Yaml().loadAll(getClass().getResourceAsStream("/extensions/roles.yaml"))
            .forEach(value -> documents.add((Map<String, Object>) value));
        var publicRoles = documents.stream().filter(role -> {
            var metadata = (Map<String, Object>) role.get("metadata");
            var labels = (Map<String, Object>) metadata.get("labels");
            return "true".equals(labels.get("rbac.authorization.halo.run/aggregate-to-anonymous"));
        }).toList();
        assertThat(publicRoles).hasSize(2);
        var role = publicRoles.stream().filter(value -> "plugin-lingui-mcp-transport".equals(
            ((Map<String, Object>) value.get("metadata")).get("name"))).findFirst().orElseThrow();
        var metadata = (Map<String, Object>) role.get("metadata");
        assertThat((Map<String, Object>) metadata.get("labels")).containsEntry("halo.run/hidden", "true");
        var rules = (List<Map<String, Object>>) role.get("rules");
        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst()).containsEntry("apiGroups", List.of("api.lingui.acanyo.com"))
            .containsEntry("resources", List.of("mcp")).containsEntry("verbs", List.of("create"));
    }
}
