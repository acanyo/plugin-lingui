package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static com.acanyo.halo.plugin.lingui.ai.mcp.history.McpHistoryDtos.*;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpKeyService.Grant;
import com.acanyo.halo.plugin.lingui.model.McpActivity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ReactiveExtensionClient;

@Service
public class McpActivityService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(McpActivityService.class);
    private static final Set<String> TOOLS = Set.of("search_components", "get_component_schemas", "get_current_work", "get_guidance", "validate_design", "submit_design_draft");
    private final ReactiveExtensionClient client;
    private final ObjectMapper mapper = new ObjectMapper();
    public McpActivityService(ReactiveExtensionClient client) { this.client = client; }

    public Mono<Map<String, Object>> trace(Grant grant, JsonNode message, Supplier<Mono<Map<String, Object>>> action) {
        return Mono.defer(() -> {
            String method = message.path("method").asText();
            if (!message.has("id") || !"2.0".equals(message.path("jsonrpc").asText())
                || !Set.of("tools/call", "resources/read").contains(method)) return action.get();
            long started = System.nanoTime();
            return action.get().flatMap(result -> {
                JsonNode reply = mapper.valueToTree(result);
                boolean failed = reply.has("error") || reply.path("result").path("isError").asBoolean(false);
                JsonNode feedback = reply.path("result").path("structuredContent");
                boolean needsFix = feedback.has("valid") && !feedback.path("valid").asBoolean();
                String requested = message.path("params").path("name").asText();
                String operation = method.equals("resources/read") ? "read_skill" : TOOLS.contains(requested) ? requested : "unknown_tool";
                var args = message.path("params").path("arguments");
                var record = new McpActivity();
                record.setMetadata(McpRecordOwner.metadata("mcp-activity-" + UUID.randomUUID(), grant.owner()));
                var spec = new McpActivity.ActivitySpec();
                spec.setOwner(grant.owner()); spec.setKeyId(grant.keyId()); spec.setKeyName(grant.keyName());
                spec.setOperation(operation); spec.setStatus(failed ? "error" : needsFix ? "needs-fix" : "success");
                spec.setSummary(summary(operation, feedback, needsFix));
                String work = args.path("workName").asText();
                spec.setWorkName(!failed && Set.of("get_current_work", "submit_design_draft").contains(operation)
                    && work.matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}") ? work : "");
                spec.setCreatedAt(Instant.now().toString()); spec.setElapsedMs((System.nanoTime() - started) / 1_000_000);
                record.setSpec(spec);
                return client.create(record).then(prune(grant.owner())).thenReturn(result)
                    .onErrorResume(error -> {
                        LOG.warn("Lingui MCP activity persistence failed: {}", error.getClass().getSimpleName());
                        return Mono.just(result);
                    });
            });
        });
    }
    private String summary(String operation, JsonNode feedback, boolean needsFix) {
        return switch (operation) {
            case "get_component_schemas" -> {
                var names = new java.util.ArrayList<String>();
                var fields = feedback.path("components").fieldNames();
                while (fields.hasNext()) {
                    if (names.size() == 12) break;
                    String name = fields.next();
                    if (name.matches("[a-zA-Z][a-zA-Z0-9._-]{0,79}")) names.add(name);
                }
                yield names.isEmpty() ? "查询组件参数" : "组件参数：" + String.join("、", names);
            }
            case "search_components" -> "查询可用组件目录";
            case "get_current_work" -> "读取项目最近保存的版本";
            case "get_guidance" -> "读取设计、交互或数据规则";
            case "validate_design" -> needsFix ? "设计预检未通过，需要修正" : "设计预检";
            case "submit_design_draft" -> "提交创作草稿，等待用户预览和确认";
            case "read_skill" -> "读取创作 Skill";
            default -> "未识别的工具调用";
        };
    }
    private reactor.core.publisher.Flux<McpActivity> records(String owner) {
        return client.listAll(McpActivity.class, McpRecordOwner.options(owner), Sort.unsorted())
            .filter(record -> record.getMetadata().getDeletionTimestamp() == null && owner.equals(record.getSpec().getOwner()));
    }
    private Mono<Void> prune(String owner) {
        return records(owner).sort(Comparator.comparing((McpActivity item) -> item.getSpec().getCreatedAt()).reversed())
            .skip(300).concatMap(client::delete).then();
    }
    public Mono<ActivityList> list(String owner) {
        return records(owner).sort(Comparator.comparing((McpActivity item) -> item.getSpec().getCreatedAt()).reversed())
            .take(300).map(record -> {
                var s = record.getSpec();
                return new ActivityInfo(record.getMetadata().getName(), s.getKeyId(), s.getKeyName(), s.getOperation(),
                    s.getSummary(), s.getWorkName(), s.getStatus(), s.getCreatedAt(), s.getElapsedMs());
            }).collectList().map(ActivityList::new);
    }
}
