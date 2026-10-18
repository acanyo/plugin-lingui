package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static org.assertj.core.api.Assertions.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.yaml.snakeyaml.Yaml;

class McpAccessRolesTest {
    @SuppressWarnings("unchecked")
    @Test void linguiDoesNotGrantAnonymousMcpAccessOrManageOfficialKeys() {
        var documents = new ArrayList<Map<String, Object>>();
        new Yaml().loadAll(getClass().getResourceAsStream("/extensions/roles.yaml"))
            .forEach(value -> documents.add((Map<String, Object>) value));
        var publicRoles = documents.stream().filter(role -> {
            var metadata = (Map<String, Object>) role.get("metadata");
            var labels = (Map<String, Object>) metadata.get("labels");
            return "true".equals(labels.get("rbac.authorization.halo.run/aggregate-to-anonymous"));
        }).toList();
        assertThat(publicRoles).allSatisfy(role -> {
            var rules = (List<Map<String, Object>>) role.get("rules");
            assertThat(rules).allSatisfy(rule ->
                assertThat((List<String>) rule.get("resources")).noneMatch(resource -> resource.startsWith("mcp")));
        });
        var role = documents.stream().filter(value -> "plugin-lingui-role-mcp".equals(
            ((Map<String, Object>) value.get("metadata")).get("name"))).findFirst().orElseThrow();
        var rules = (List<Map<String, Object>>) role.get("rules");
        assertThat(rules).allSatisfy(rule -> assertThat((List<String>) rule.get("resources"))
            .noneMatch(resource -> resource.startsWith("mcpkeys")));
        assertThat(rules).anySatisfy(rule -> assertThat(rule)
            .containsEntry("apiGroups", List.of("console.api.lingui.acanyo.com"))
            .containsEntry("resources", List.of("mcp")).containsEntry("verbs", List.of("create")));
    }
}
