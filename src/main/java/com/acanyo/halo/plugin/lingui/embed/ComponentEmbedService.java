package com.acanyo.halo.plugin.lingui.embed;

import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.ai.validation.SavedDocumentNormalizer;
import com.acanyo.halo.plugin.lingui.model.ComponentEmbed;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.StreamReadConstraints;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;

@Service
public class ComponentEmbedService {
    public record EmbedStatus(String name, boolean enabled, Integer revision) {}
    private final ReactiveExtensionClient client;
    private final DesignValidator validator;
    private final ObjectMapper mapper = new ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);

    public ComponentEmbedService(ReactiveExtensionClient client, DesignValidator validator) {
        this.client = client;
        this.validator = validator;
        mapper.getFactory().setStreamReadConstraints(StreamReadConstraints.builder()
            .maxNestingDepth(64).maxStringLength(2097152).build());
    }

    public Mono<EmbedStatus> status(String name) {
        return work(name).flatMap(work -> access(name).map(enabled ->
            new EmbedStatus(name, enabled, work.getSpec().getRevision())));
    }

    public Mono<EmbedStatus> setEnabled(String name, boolean enabled) {
        return work(name).flatMap(work -> {
            Mono<?> checked = enabled
                ? Mono.fromCallable(() -> latest(work)).subscribeOn(Schedulers.boundedElastic())
                : Mono.just(work);
            return checked.then(Mono.defer(() -> client.fetch(ComponentEmbed.class, name)
                .filter(resource -> resource.getMetadata().getDeletionTimestamp() == null)
                .flatMap(resource -> {
                    resource.getSpec().setEnabled(enabled);
                    return client.update(resource);
                }).switchIfEmpty(Mono.defer(() -> {
                    var resource = new ComponentEmbed();
                    var metadata = new Metadata(); metadata.setName(name); resource.setMetadata(metadata);
                    var spec = new ComponentEmbed.EmbedSpec(); spec.setEnabled(enabled); resource.setSpec(spec);
                    return client.create(resource);
                }))).map(resource -> new EmbedStatus(name, enabled, work.getSpec().getRevision())));
        });
    }

    public Mono<JsonNode> read(String name) {
        requireName(name);
        return access(name).filter(Boolean::booleanValue).switchIfEmpty(Mono.error(missing()))
            .flatMap(ignored -> work(name))
            .publishOn(Schedulers.boundedElastic())
            .map(work -> {
                try { return latest(work); }
                catch (IllegalArgumentException error) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "组件内容需要在工作台修正后重新保存");
                }
            });
    }

    private Mono<Boolean> access(String name) {
        return client.fetch(ComponentEmbed.class, name)
            .filter(resource -> resource.getMetadata().getDeletionTimestamp() == null && resource.getSpec() != null)
            .map(resource -> Boolean.TRUE.equals(resource.getSpec().getEnabled())).defaultIfEmpty(false);
    }

    private Mono<ComponentTemplate> work(String name) {
        requireName(name);
        return client.fetch(ComponentTemplate.class, name)
            .filter(resource -> resource.getMetadata().getDeletionTimestamp() == null && resource.getSpec() != null)
            .switchIfEmpty(Mono.error(missing()));
    }

    private JsonNode latest(ComponentTemplate work) {
        try {
            String history = work.getSpec().getHistory();
            if (history == null || history.length() > 2097152) throw new IllegalArgumentException("项目版本记录无效");
            var revisions = mapper.readTree(history);
            if (!revisions.isArray() || revisions.isEmpty() || revisions.size() > 20)
                throw new IllegalArgumentException("项目版本记录无效");
            var latest = revisions.get(revisions.size() - 1);
            if (!latest.path("version").isIntegralNumber() || latest.path("version").asInt() < 1
                || !java.util.Objects.equals(work.getSpec().getRevision(), latest.path("version").asInt()))
                throw new IllegalArgumentException("项目最新版本不一致，请重新保存");
            var document = SavedDocumentNormalizer.normalize(latest.path("document"), validator);
            if (!document.isObject()) throw new IllegalArgumentException("项目文档无效");
            ((com.fasterxml.jackson.databind.node.ObjectNode) document).put("title", work.getSpec().getDisplayName());
            var result = mapper.createObjectNode();
            result.set("document", document);
            if (latest.hasNonNull("theme")) result.set("theme", latest.path("theme"));
            validator.requireValid(result);
            result.put("revision", latest.path("version").asInt());
            return result;
        } catch (java.io.IOException error) {
            throw new IllegalArgumentException("项目版本记录不是有效 JSON");
        }
    }

    private static void requireName(String name) {
        if (name == null || !name.matches("[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "组件 ID 无效");
    }
    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "组件不存在或未开启公开嵌入");
    }
}
