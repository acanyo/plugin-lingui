package com.acanyo.halo.plugin.lingui.ai;

import static org.mockito.Mockito.*;
import static org.assertj.core.api.Assertions.*;
import com.acanyo.halo.plugin.lingui.ai.mcp.SavedWorkReader;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

class SavedWorkReaderTest {
    private final ReactiveExtensionClient client = mock(ReactiveExtensionClient.class);
    private final SavedWorkReader reader = new SavedWorkReader(client, new DesignValidator());
    private ComponentTemplate legacy(String catalog) {
        var work = new ComponentTemplate(); work.setMetadata(new Metadata()); work.getMetadata().setName("legacy");
        var spec = new ComponentTemplate.TemplateSpec();
        spec.setHistory("""
            [{"document":{"schemaVersion":"lingui.document/1","title":"Old work","parameters":[],"messages":[
              {"version":"v0.9.1","createSurface":{"surfaceId":"old","catalogId":"%s"}},
              {"version":"v0.9.1","updateComponents":{"surfaceId":"old","components":[{"id":"root","component":"Text","text":"Hello"}]}},
              {"version":"v0.9.1","updateDataModel":{"surfaceId":"old","value":{"counter":2}}}
            ]}}]
            """.formatted(catalog));
        work.setSpec(spec); return work;
    }
    @Test void normalizesAuthorizedSavedLegacySnapshotsWithoutChangingHistory() {
        var work = legacy("urn:lingui:catalog:1"); var original = work.getSpec().getHistory();
        when(client.fetch(ComponentTemplate.class, "legacy")).thenReturn(Mono.just(work));
        var result = new ObjectMapper().valueToTree(reader.read("legacy").block());
        assertThat(result.path("document").path("schemaVersion").asText()).isEqualTo("lingui.document/2");
        assertThat(result.path("document").path("source").asText()).contains("root = Text(");
        assertThat(result.path("document").path("state").path("counter").asInt()).isEqualTo(2);
        assertThat(work.getSpec().getHistory()).isEqualTo(original);
        verify(client, never()).update(any());
    }
    @Test void refusesUnknownLegacyCatalogAndDeletedWorks() {
        var work = legacy("https://unknown-catalog.example");
        when(client.fetch(ComponentTemplate.class, "legacy")).thenReturn(Mono.just(work));
        assertThatThrownBy(() -> reader.read("legacy").block()).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("打开并保存");
        work.getMetadata().setDeletionTimestamp(java.time.Instant.now());
        assertThatThrownBy(() -> reader.read("legacy").block())
            .isInstanceOfSatisfying(ResponseStatusException.class, error -> {
                assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
                assertThat(error.getReason()).contains("已删除");
            });
        when(client.fetch(ComponentTemplate.class, "missing")).thenReturn(Mono.empty());
        assertThatThrownBy(() -> reader.read("missing").block())
            .isInstanceOfSatisfying(ResponseStatusException.class, error ->
                assertThat(error.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
