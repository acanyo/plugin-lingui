package com.acanyo.halo.plugin.lingui.embed;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.model.ComponentEmbed;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class ComponentEmbedServiceTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, ComponentEmbed> grants = new HashMap<>();
    private final ComponentEmbedService service = new ComponentEmbedService(client, new DesignValidator());
    private ComponentTemplate project;

    @BeforeEach void setup() throws Exception {
        project = new ComponentTemplate();
        var metadata = new Metadata(); metadata.setName("weather"); project.setMetadata(metadata);
        var spec = new ComponentTemplate.TemplateSpec(); spec.setDisplayName("实时天气"); spec.setRevision(1);
        spec.setHistory(mapper.writeValueAsString(List.of(revision(1, "初始天气")))); project.setSpec(spec);
        when(client.fetch(eq(ComponentTemplate.class), anyString())).thenAnswer(call ->
            Mono.justOrEmpty("weather".equals(call.getArgument(1)) ? project : null));
        when(client.fetch(eq(ComponentEmbed.class), anyString())).thenAnswer(call ->
            Mono.justOrEmpty(grants.get(call.getArgument(1))).map(value -> mapper.convertValue(value, ComponentEmbed.class)));
        when(client.create(any(ComponentEmbed.class))).thenAnswer(call -> save(call.getArgument(0)));
        when(client.update(any(ComponentEmbed.class))).thenAnswer(call -> save(call.getArgument(0)));
    }
    private Mono<ComponentEmbed> save(ComponentEmbed resource) {
        grants.put(resource.getMetadata().getName(), mapper.convertValue(resource, ComponentEmbed.class));
        return Mono.just(resource);
    }
    private Map<String, Object> revision(int version, String content) {
        return Map.of("version", version, "createdAt", "2026-10-16T00:00:00Z", "document", Map.of(
            "schemaVersion", "lingui.document/2", "title", "旧名称", "parameters", List.of(),
            "source", "root = Text({\"id\":\"root\",\"text\":\"" + content + "\"}, [])", "state", Map.of()));
    }
    private void missing(Runnable action) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ResponseStatusException.class,
            error -> assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test void privateProjectsCannotBeReadAndAreNotEvenFetchedByAnonymousLookup() {
        assertThat(service.status("weather").block().enabled()).isFalse();
        clearInvocations(client);
        missing(() -> service.read("weather").block());
        verify(client, never()).fetch(eq(ComponentTemplate.class), anyString());
    }
    @Test void publicReferenceReadsOnlyTheLatestSavedRevisionAndFollowsUpdates() throws Exception {
        assertThat(service.setEnabled("weather", true).block().enabled()).isTrue();
        assertThat(service.read("weather").block().path("document").path("title").asText()).isEqualTo("实时天气");
        project.getSpec().setRevision(2);
        project.getSpec().setHistory(mapper.writeValueAsString(List.of(revision(1, "旧版本私有内容"), revision(2, "新天气"))));
        var result = service.read("weather").block();
        assertThat(result.path("revision").asInt()).isEqualTo(2);
        assertThat(result.toString()).contains("新天气").doesNotContain("旧版本私有内容", "history", "createdAt");
        assertThat(service.status("weather").block().revision()).isEqualTo(2);
    }
    @Test void disablingOrDeletingTheProjectStopsPublicAccess() {
        service.setEnabled("weather", true).block();
        service.setEnabled("weather", false).block();
        missing(() -> service.read("weather").block());
        service.setEnabled("weather", true).block();
        project.getMetadata().setDeletionTimestamp(Instant.now());
        missing(() -> service.read("weather").block());
    }
    @Test void malformedDesignCannotBeEnabledButCanAlwaysBeDisabled() {
        service.setEnabled("weather", true).block();
        project.getSpec().setHistory("[]");
        assertThatThrownBy(() -> service.setEnabled("weather", true).block()).isInstanceOf(IllegalArgumentException.class);
        assertThat(service.setEnabled("weather", false).block().enabled()).isFalse();
    }
    @Test void invalidNamesAndMissingProjectsCannotCreatePublicAccess() {
        assertThatThrownBy(() -> service.status("../secret").block()).isInstanceOf(ResponseStatusException.class);
        missing(() -> service.setEnabled("missing", true).block());
        assertThat(grants).isEmpty();
    }
}
