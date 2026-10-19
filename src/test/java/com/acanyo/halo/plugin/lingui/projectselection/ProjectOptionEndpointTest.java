package com.acanyo.halo.plugin.lingui.projectselection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.acanyo.halo.plugin.lingui.model.ComponentEmbed;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class ProjectOptionEndpointTest {
    private final ReactiveExtensionClient extensions = mock(ReactiveExtensionClient.class);
    private final ProjectOptionEndpoint endpoint = new ProjectOptionEndpoint(new ProjectOptionService(extensions));
    private final WebTestClient client = WebTestClient.bindToRouterFunction(endpoint.endpoint()).build();
    private ComponentTemplate publicProject;
    private ComponentTemplate privateProject;
    private ComponentTemplate deletedProject;
    private ComponentEmbed grant;

    @BeforeEach
    void setup() {
        publicProject = project("weather", "天气", "工具", "城市气象");
        privateProject = project("draft", "私有草稿", "工具", "尚未公开");
        deletedProject = project("deleted", "已删除", "工具", "");
        deletedProject.getMetadata().setDeletionTimestamp(Instant.now());
        grant = new ComponentEmbed();
        var metadata = new Metadata();
        metadata.setName("weather");
        grant.setMetadata(metadata);
        var spec = new ComponentEmbed.EmbedSpec();
        spec.setEnabled(true);
        grant.setSpec(spec);
        when(extensions.listAll(eq(ComponentTemplate.class), any(), any()))
            .thenReturn(Flux.just(privateProject, deletedProject, publicProject));
        when(extensions.listAll(eq(ComponentEmbed.class), any(), any())).thenReturn(Flux.just(grant));
        when(extensions.fetch(eq(ComponentTemplate.class), anyString())).thenAnswer(call -> Mono.justOrEmpty(
            List.of(publicProject, privateProject, deletedProject).stream()
                .filter(project -> call.getArgument(1).equals(project.getMetadata().getName())).findFirst()));
        when(extensions.fetch(eq(ComponentEmbed.class), anyString())).thenAnswer(call ->
            Mono.justOrEmpty("weather".equals(call.getArgument(1)) ? grant : null));
    }

    @Test
    void defaultsReturnOnlyPublicMetadataWithoutHistoryAndUseConsoleGroup() {
        assertThat(endpoint.groupVersion().toString()).isEqualTo("console.api.lingui.acanyo.com/v1alpha1");
        client.get().uri("/projectoptions").exchange().expectStatus().isOk()
            .expectHeader().valueEquals("Cache-Control", "no-store")
            .expectBody().jsonPath("$.page").isEqualTo(1).jsonPath("$.size").isEqualTo(20)
            .jsonPath("$.total").isEqualTo(1).jsonPath("$.items.length()").isEqualTo(1)
            .jsonPath("$.items[0].id").isEqualTo("weather")
            .jsonPath("$.items[0].displayName").isEqualTo("天气")
            .jsonPath("$.items[0].embedEnabled").isEqualTo(true)
            .jsonPath("$.items[0].history").doesNotExist()
            .jsonPath("$.items[0].document").doesNotExist()
            .consumeWith(result -> assertThat(new String(result.getResponseBody(), java.nio.charset.StandardCharsets.UTF_8))
                .doesNotContain("private-history", "私有草稿", "已删除"));
    }

    @Test
    void queryParametersFilterPrivateMetadataBeforePagingWhenRequested() {
        client.get().uri(builder -> builder.path("/projectoptions")
                .queryParam("publicOnly", "false").queryParam("page", "1").queryParam("size", "1")
                .queryParam("keyword", "私有").queryParam("category", "工具").build())
            .exchange().expectStatus().isOk().expectBody()
            .jsonPath("$.total").isEqualTo(1).jsonPath("$.size").isEqualTo(1)
            .jsonPath("$.items[0].id").isEqualTo("draft")
            .jsonPath("$.items[0].embedEnabled").isEqualTo(false);
    }

    @Test
    void lookupDefaultsHidePrivateMissingAndDeletedProjectsAndNeverCacheFailures() {
        client.get().uri("/projectoptions/weather").exchange().expectStatus().isOk()
            .expectHeader().valueEquals("Cache-Control", "no-store")
            .expectBody().jsonPath("$.id").isEqualTo("weather").jsonPath("$.revision").isEqualTo(2)
            .jsonPath("$.history").doesNotExist();
        for (String name : List.of("draft", "missing", "deleted")) {
            client.get().uri("/projectoptions/" + name).exchange().expectStatus().isNotFound()
                .expectHeader().valueEquals("Cache-Control", "no-store");
        }
        client.get().uri("/projectoptions/draft?publicOnly=false").exchange().expectStatus().isOk()
            .expectBody().jsonPath("$.id").isEqualTo("draft").jsonPath("$.embedEnabled").isEqualTo(false);
        client.get().uri("/projectoptions/deleted?publicOnly=false").exchange().expectStatus().isNotFound();
        client.get().uri("/projectoptions/missing?publicOnly=false").exchange().expectStatus().isNotFound();
    }

    @Test
    void invalidQueryAndNameInputsReturnUncached400() {
        for (String query : List.of("page=0", "page=-1", "page=no", "page=2147483648", "size=0",
            "size=101", "publicOnly=1", "publicOnly=TRUE", "publicOnly=", "page=1&page=2",
            "keyword=" + "x".repeat(121), "category=" + "x".repeat(81))) {
            client.get().uri("/projectoptions?" + query).exchange().expectStatus().isBadRequest()
                .expectHeader().valueEquals("Cache-Control", "no-store")
                .expectBody().jsonPath("$.message").isNotEmpty();
        }
        client.get().uri("/projectoptions/INVALID").exchange().expectStatus().isBadRequest()
            .expectHeader().valueEquals("Cache-Control", "no-store");
        client.get().uri("/projectoptions/weather?publicOnly=invalid").exchange().expectStatus().isBadRequest();
    }

    @Test
    void selectionEndpointDoesNotOfferMutationRoutes() {
        client.put().uri("/projectoptions/weather").exchange().expectStatus().isNotFound();
        client.post().uri("/projectoptions").exchange().expectStatus().isNotFound();
        client.delete().uri("/projectoptions/weather").exchange().expectStatus().isNotFound();
        assertThat(grant.getSpec().getEnabled()).isTrue();
    }

    private static ComponentTemplate project(String id, String name, String category, String description) {
        var project = new ComponentTemplate();
        var metadata = new Metadata();
        metadata.setName(id);
        project.setMetadata(metadata);
        var spec = new ComponentTemplate.TemplateSpec();
        spec.setDisplayName(name);
        spec.setCategory(category);
        spec.setDescription(description);
        spec.setRevision(2);
        spec.setHistory("private-history");
        project.setSpec(spec);
        return project;
    }
}
