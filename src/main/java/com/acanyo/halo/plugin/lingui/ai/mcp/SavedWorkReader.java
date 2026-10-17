package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.app.extension.ReactiveExtensionClient;

/** MCP access is explicitly granted with component read permission; no ambient 'current work'. */
@Component
public class SavedWorkReader {
    private final com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
    private final ReactiveExtensionClient client;
    private final DesignValidator validator;

    public SavedWorkReader(ReactiveExtensionClient client, DesignValidator validator) {
        this.client = client;
        this.validator = validator;
    }

    public Mono<Object> read(String name) {
        return client.fetch(ComponentTemplate.class, name)
            .filter(work -> work.getMetadata().getDeletionTimestamp() == null)
            .switchIfEmpty(Mono.error(new IllegalArgumentException("作品不存在或已删除：" + name)))
            .publishOn(Schedulers.boundedElastic()).map(work -> {
                // History can be 2 MiB, but only the explicitly selected latest revision is exposed.
                try {
                    var revisions = mapper.readTree(work.getSpec().getHistory());
                    if (!revisions.isArray() || revisions.isEmpty() || revisions.size() > 20)
                        throw new IllegalArgumentException("作品历史记录无效");
                    var latest = revisions.get(revisions.size() - 1);
                    var result = mapper.createObjectNode();
                    result.put("workName", name);
                    result.put("revision", work.getSpec().getRevision());
                    result.set("document", com.acanyo.halo.plugin.lingui.ai.validation.SavedDocumentNormalizer.normalize(latest.path("document"), validator));
                    if (latest.has("theme")) result.set("theme", latest.path("theme"));
                    var design = result.deepCopy();
                    design.remove("workName");
                    design.remove("revision");
                    validator.requireValid(design);
                    return (Object) result;
                } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
                    throw new IllegalArgumentException("作品历史记录不是有效 JSON");
                }
            });
    }
}
