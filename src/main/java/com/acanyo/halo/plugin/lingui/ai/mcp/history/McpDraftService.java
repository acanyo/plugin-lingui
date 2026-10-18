package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static com.acanyo.halo.plugin.lingui.ai.mcp.history.McpHistoryDtos.*;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.acanyo.halo.plugin.lingui.model.McpDraft;
import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Comparator;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.app.extension.ReactiveExtensionClient;

@Service
public class McpDraftService {
    private final ReactiveExtensionClient client;
    private final DesignValidator validator;
    private final McpOwnerPermissions permissions;
    public McpDraftService(ReactiveExtensionClient client, DesignValidator validator, McpOwnerPermissions permissions) {
        this.client = client; this.validator = validator; this.permissions = permissions;
    }

    public Mono<DraftInfo> submit(String owner, JsonNode input) {
        return Mono.fromCallable(() -> prepare(owner, input)).subscribeOn(Schedulers.boundedElastic())
            .flatMap(draft -> authorizeTarget(owner, draft.getSpec()).then(Mono.defer(() ->
                client.fetch(McpDraft.class, draft.getMetadata().getName())
                    .flatMap(existing -> sameSubmission(existing, draft))
                    .switchIfEmpty(records(owner).count().flatMap(count -> {
                        if (count >= 100) return Mono.error(bad("已保留 100 份外部 AI 草稿，请在工作台删除不需要的草稿后重试"));
                        return client.create(draft).map(this::info)
                            .onErrorResume(error -> client.fetch(McpDraft.class, draft.getMetadata().getName())
                                .flatMap(saved -> sameSubmission(saved, draft)).switchIfEmpty(Mono.error(error)));
                    }))
            )));
    }

    private McpDraft prepare(String owner, JsonNode input) {
        validator.parse(input.toString());
        var fields = input.fieldNames();
        var allowed = Set.of("submissionId", "title", "summary", "kind", "design", "workName", "baseRevision");
        while (fields.hasNext()) if (!allowed.contains(fields.next())) throw bad("草稿包含不支持的参数");
        String submission = text(input, "submissionId", 80, true);
        if (!submission.matches("[a-zA-Z0-9_-]+")) throw bad("submissionId 仅支持字母、数字、下划线和连字符");
        String title = text(input, "title", 120, true);
        String summary = text(input, "summary", 500, false);
        String kind = text(input, "kind", 20, true);
        if (!Set.of("component", "theme").contains(kind)) throw bad("kind 必须为 component 或 theme");
        String work = text(input, "workName", 160, false);
        if (!work.isEmpty() && (!kind.equals("component") || !work.matches("[a-zA-Z0-9][a-zA-Z0-9._-]*"))) throw bad("目标项目资源名称无效");
        Integer revision = null;
        if (!work.isEmpty()) {
            if (!input.path("baseRevision").isIntegralNumber() || !input.path("baseRevision").canConvertToInt() || input.path("baseRevision").asInt() < 1)
                throw bad("修改项目必须提供读取时的 baseRevision");
            revision = input.path("baseRevision").asInt();
        } else if (input.has("baseRevision")) throw bad("baseRevision 需要同时指定 workName");
        JsonNode design = input.path("design");
        if (kind.equals("theme")) validator.requireTheme(design);
        else {
            design = validator.normalizeToolDesign(design);
            validator.requireValid(design);
        }
        if (design.toString().getBytes(StandardCharsets.UTF_8).length > 262144) throw bad("设计不能超过 256 KiB");
        var draft = new McpDraft();
        String id = "mcp-draft-" + UUID.nameUUIDFromBytes((owner + "\0" + submission).getBytes(StandardCharsets.UTF_8));
        draft.setMetadata(McpRecordOwner.metadata(id, owner));
        var spec = new McpDraft.DraftSpec();
        spec.setOwner(owner);
        spec.setTitle(title); spec.setSummary(summary); spec.setKind(kind); spec.setWorkName(work);
        spec.setBaseRevision(revision); spec.setCreatedAt(Instant.now().toString()); spec.setDesign(design.toString());
        draft.setSpec(spec);
        return draft;
    }

    private Mono<Void> authorizeTarget(String owner, McpDraft.DraftSpec spec) {
        if (spec.getWorkName().isEmpty()) return Mono.empty();
        return permissions.requireWork(owner, spec.getWorkName())
            .then(client.fetch(ComponentTemplate.class, spec.getWorkName())
                .filter(work -> work.getMetadata().getDeletionTimestamp() == null)
                .switchIfEmpty(Mono.error(bad("目标项目不存在或已删除，请改为新作品草稿")))).then();
    }
    private Mono<DraftInfo> sameSubmission(McpDraft existing, McpDraft next) {
        var a = existing.getSpec(); var b = next.getSpec();
        if (existing.getMetadata().getDeletionTimestamp() != null || !a.getOwner().equals(b.getOwner())
            || !a.getDesign().equals(b.getDesign()) || !a.getTitle().equals(b.getTitle())
            || !a.getSummary().equals(b.getSummary()) || !a.getKind().equals(b.getKind())
            || !a.getWorkName().equals(b.getWorkName()) || !java.util.Objects.equals(a.getBaseRevision(), b.getBaseRevision()))
            return Mono.error(bad("submissionId 已用于另一份草稿；修改设计请使用新的 submissionId"));
        return Mono.just(info(existing));
    }
    public Mono<DraftList> list(String owner) {
        return records(owner).map(this::info).sort(Comparator.comparing(DraftInfo::createdAt).reversed())
            .take(100).collectList().map(DraftList::new);
    }
    public Mono<DraftDetail> get(String owner, String id) {
        return owned(owner, id).map(draft -> new DraftDetail(info(draft), draft.getSpec().getDesign()));
    }
    public Mono<Void> loaded(String owner, String id) {
        return owned(owner, id).flatMap(draft -> {
            draft.getSpec().setLoadedAt(Instant.now().toString()); return client.update(draft);
        }).then();
    }
    public Mono<Void> delete(String owner, String id) { return owned(owner, id).flatMap(client::delete).then(); }
    private Mono<McpDraft> owned(String owner, String id) {
        return client.fetch(McpDraft.class, id)
            .filter(draft -> draft.getMetadata().getDeletionTimestamp() == null && owner.equals(draft.getSpec().getOwner()))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "草稿不存在或无权访问")));
    }
    private Flux<McpDraft> records(String owner) {
        return client.listAll(McpDraft.class, McpRecordOwner.options(owner), Sort.unsorted())
            .filter(draft -> draft.getMetadata().getDeletionTimestamp() == null && owner.equals(draft.getSpec().getOwner()));
    }
    private DraftInfo info(McpDraft draft) {
        var s = draft.getSpec();
        return new DraftInfo(draft.getMetadata().getName(), s.getTitle(), s.getSummary(), s.getKind(),
            s.getWorkName(), s.getBaseRevision(), s.getCreatedAt(), s.getLoadedAt());
    }
    private static String text(JsonNode node, String name, int max, boolean required) {
        if (!node.has(name) && !required) return "";
        if (!node.path(name).isTextual() || node.path(name).asText().length() > max || required && node.path(name).asText().isBlank())
            throw bad(name + " 必须是" + (required ? "非空" : "") + "文本，最多 " + max + " 字符");
        return node.path(name).asText().trim();
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
