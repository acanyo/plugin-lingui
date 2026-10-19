package com.acanyo.halo.plugin.lingui.projectselection;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.acanyo.halo.plugin.lingui.model.ComponentEmbed;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class ProjectOptionServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final ProjectOptionService projects = new ProjectOptionService(client);
    private final List<ComponentTemplate> templates = new ArrayList<>();
    private final Map<String, ComponentEmbed> embeds = new HashMap<>();

    @BeforeEach
    void setup() {
        when(client.listAll(eq(ComponentTemplate.class), any(), any()))
            .thenAnswer(ignored -> Flux.fromIterable(templates));
        when(client.listAll(eq(ComponentEmbed.class), any(), any()))
            .thenAnswer(ignored -> Flux.fromIterable(embeds.values()));
        when(client.fetch(eq(ComponentTemplate.class), anyString())).thenAnswer(call ->
            Mono.justOrEmpty(templates.stream().filter(project -> project.getMetadata() != null
                && call.getArgument(1).equals(project.getMetadata().getName())).findFirst()));
        when(client.fetch(eq(ComponentEmbed.class), anyString())).thenAnswer(call ->
            Mono.justOrEmpty(embeds.get(call.getArgument(1))));
    }

    @Test
    void publicSelectionJoinsGrantsWithoutReadingDocumentsOrPublishing() throws Exception {
        var publicProject = project("weather", "天气", "工具", "城市天气");
        var spec = spy(publicProject.getSpec());
        publicProject.setSpec(spec);
        project("private", "私有作品", "工具", "不可枚举");
        embed("weather", true);

        var result = projects.list(1, 20, "", "", true).block();
        assertThat(result.items()).containsExactly(
            new ProjectOption("weather", "天气", "工具", "城市天气", 1, true));
        assertThat(result.total()).isEqualTo(1);
        assertThat(new ObjectMapper().writeValueAsString(result))
            .doesNotContain("history", "document", "private-history", "私有作品");
        verify(spec, never()).getHistory();
        verify(client).listAll(eq(ComponentTemplate.class), any(), any());
        verify(client).listAll(eq(ComponentEmbed.class), any(), any());
        verifyNoMoreInteractions(client);
    }

    @Test
    void filteringPrecedesStableSortingAndPagination() {
        project("c", "Beta", "工具", "weather forecast");
        project("b", "Alpha", "工具", "Weather for B");
        project("a", "Alpha", "工具", "weather for A");
        project("other-category", "AAA", "图表", "weather");
        project("other-query", "AAA", "工具", "unrelated");
        templates.forEach(project -> embed(project.getMetadata().getName(), true));

        var first = projects.list(1, 2, " WEATHER ", " 工具 ", true).block();
        assertThat(first.items()).extracting(ProjectOption::id).containsExactly("a", "b");
        assertThat(first.total()).isEqualTo(3);
        assertThat(first.page()).isEqualTo(1);
        assertThat(first.size()).isEqualTo(2);
        assertThat(projects.list(2, 2, "weather", "工具", true).block().items())
            .extracting(ProjectOption::id).containsExactly("c");
        assertThat(projects.list(Integer.MAX_VALUE, 100, "weather", "工具", true).block().items())
            .isEmpty();
    }

    @Test
    void nonPublicSelectionReturnsPrivateMetadataAndNormalizesOptionalStrings() {
        var project = project("draft", "草稿", null, null);
        project.getSpec().setHistory("not JSON and must not be parsed");

        var result = projects.list(1, 20, null, null, false).block();
        assertThat(result.items()).containsExactly(new ProjectOption("draft", "草稿", "", "", 1, false));
        assertThat(projects.get("draft", false).block()).isEqualTo(result.items().getFirst());
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("draft", true).block());
    }

    @Test
    void deletedAndMalformedRecordsAreExcludedAndDeletedGrantsStayPrivate() {
        project("valid", "公开项目", "", "");
        embed("valid", true);
        var deleted = project("deleted", "已删除", "", "");
        deleted.getMetadata().setDeletionTimestamp(Instant.now());
        embed("deleted", true);
        var noSpec = project("no-spec", "无信息", "", "");
        noSpec.setSpec(null);
        embed("no-spec", true);
        project("no-name", "", "", "");
        embed("no-name", true);
        var badRevision = project("bad-revision", "版本异常", "", "");
        badRevision.getSpec().setRevision(0);
        embed("bad-revision", true);
        project("INVALID", "ID 异常", "", "");
        embed("INVALID", true);
        var noMetadata = project("no-metadata", "无标识", "", "");
        noMetadata.setMetadata(null);
        project("revoked", "撤销公开", "", "");
        embed("revoked", true).getMetadata().setDeletionTimestamp(Instant.now());
        project("no-grant-spec", "无授权信息", "", "");
        embed("no-grant-spec", true).setSpec(null);
        project("disabled", "关闭公开", "", "");
        embed("disabled", false);

        assertThat(projects.list(1, 20, "", "", true).block().items())
            .extracting(ProjectOption::id).containsExactly("valid");
        assertThat(projects.list(1, 20, "", "", false).block().items())
            .extracting(ProjectOption::id).containsExactlyInAnyOrder("valid", "revoked", "no-grant-spec", "disabled");
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("deleted", false).block());
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("no-spec", false).block());
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("revoked", true).block());
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("missing", false).block());
    }

    @Test
    void publicLookupDoesNotFetchPrivateProjectMetadata() {
        expectStatus(HttpStatus.NOT_FOUND, () -> projects.get("private", true).block());
        verify(client, never()).fetch(eq(ComponentTemplate.class), anyString());
    }

    @Test
    void invalidQueriesAndNamesAreRejected() {
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.list(0, 20, "", "", true));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.list(1, 101, "", "", true));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.list(1, 0, "", "", true));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.list(1, 20, "x".repeat(121), "", true));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.list(1, 20, "", "x".repeat(81), true));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.get("../secret", false));
        expectStatus(HttpStatus.BAD_REQUEST, () -> projects.get("x".repeat(81), false));
    }

    private ComponentTemplate project(String id, String name, String category, String description) {
        var project = new ComponentTemplate();
        var metadata = new Metadata();
        metadata.setName(id);
        project.setMetadata(metadata);
        var spec = new ComponentTemplate.TemplateSpec();
        spec.setDisplayName(name);
        spec.setCategory(category);
        spec.setDescription(description);
        spec.setRevision(1);
        spec.setHistory("private-history");
        project.setSpec(spec);
        templates.add(project);
        return project;
    }

    private ComponentEmbed embed(String id, boolean enabled) {
        var embed = new ComponentEmbed();
        var metadata = new Metadata();
        metadata.setName(id);
        embed.setMetadata(metadata);
        var spec = new ComponentEmbed.EmbedSpec();
        spec.setEnabled(enabled);
        embed.setSpec(spec);
        embeds.put(id, embed);
        return embed;
    }

    private static void expectStatus(HttpStatus status, Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            error -> assertThat(error.getStatusCode()).isEqualTo(status));
    }
}
