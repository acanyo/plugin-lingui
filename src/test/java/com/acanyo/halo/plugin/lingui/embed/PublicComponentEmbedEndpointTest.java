package com.acanyo.halo.plugin.lingui.embed;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.reactive.server.WebTestClient;
import org.springframework.web.server.ResponseStatusException;
import org.yaml.snakeyaml.Yaml;
import reactor.core.publisher.Mono;

class PublicComponentEmbedEndpointTest {
    private final ComponentEmbedService embeds = mock(ComponentEmbedService.class);
    private final WebTestClient client = WebTestClient.bindToRouterFunction(new PublicComponentEmbedEndpoint(embeds).endpoint()).build();
    @Test void publicEndpointReturnsOnlyEnabledContentAndDisallowsListingAndMutation() {
        when(embeds.read("weather")).thenReturn(Mono.just(new ObjectMapper().valueToTree(Map.of("revision", 2, "document", Map.of("title", "天气")))));
        client.get().uri("/componentembeds/weather").exchange().expectStatus().isOk().expectHeader().valueEquals("Cache-Control", "no-store")
            .expectBody().jsonPath("$.revision").isEqualTo(2).jsonPath("$.document.title").isEqualTo("天气");
        client.get().uri("/componentembeds").exchange().expectStatus().isNotFound();
        client.put().uri("/componentembeds/weather").exchange().expectStatus().isNotFound();
        client.delete().uri("/componentembeds/weather").exchange().expectStatus().isNotFound();
    }
    @Test void disabledEmbedsReturnUncached404WithoutProjectDetails() {
        when(embeds.read("private")).thenReturn(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "组件不存在或未开启公开嵌入")));
        client.get().uri("/componentembeds/private").exchange().expectStatus().isNotFound()
            .expectHeader().valueEquals("Cache-Control", "no-store").expectBody().jsonPath("$.message").isEqualTo("组件不存在或未开启公开嵌入");
    }
    @SuppressWarnings("unchecked")
    @Test void anonymousRoleGrantsOnlySinglePublicReadsAndNoInternalModelOrConsoleAccess() {
        Map<String, Object> role = null;
        for (Object item : new Yaml().loadAll(getClass().getResourceAsStream("/extensions/roles.yaml"))) {
            var value = (Map<String, Object>) item;
            if ("plugin-lingui-public-embeds".equals(((Map<String, Object>) value.get("metadata")).get("name"))) role = value;
        }
        assertThat(role).isNotNull();
        var rules = (List<Map<String, Object>>) role.get("rules");
        assertThat(rules).hasSize(1);
        assertThat(rules.getFirst()).containsEntry("apiGroups", List.of("api.lingui.acanyo.com"))
            .containsEntry("resources", List.of("componentembeds")).containsEntry("verbs", List.of("get"));
    }
}
