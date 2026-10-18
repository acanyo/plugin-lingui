package com.acanyo.halo.plugin.lingui.ai.mcp.history;

import static com.acanyo.halo.plugin.lingui.ai.mcp.history.McpHistoryDtos.*;
import com.acanyo.halo.plugin.lingui.model.McpActivity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.Duration;
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

    public Mono<Map<String, Object>> trace(String owner, String operation, Map<String, Object> arguments,
        Supplier<Mono<Map<String, Object>>> action) {
        return Mono.defer(() -> {
            long started = System.nanoTime();
            return action.get().flatMap(result -> {
                JsonNode feedback = mapper.valueToTree(result);
                boolean failed = feedback.path("isError").asBoolean(false);
                boolean needsFix = feedback.has("valid") && !feedback.path("valid").asBoolean();
                String tool = TOOLS.contains(operation) ? operation : "unknown_tool";
                var record = new McpActivity();
                record.setMetadata(McpRecordOwner.metadata("mcp-activity-" + UUID.randomUUID(), owner));
                var spec = new McpActivity.ActivitySpec();
                spec.setOwner(owner);
                spec.setOperation(tool); spec.setStatus(failed ? "error" : needsFix ? "needs-fix" : "success");
                spec.setSummary(summary(tool, feedback, needsFix));
                Object requestedWork = arguments.get("workName");
                String work = requestedWork instanceof String value ? value : "";
                spec.setWorkName(!failed && Set.of("get_current_work", "submit_design_draft").contains(tool)
                    && work.matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}") ? work : "");
                spec.setCreatedAt(Instant.now().toString()); spec.setElapsedMs((System.nanoTime() - started) / 1_000_000);
                record.setSpec(spec);
                return client.create(record).then(prune(owner)).thenReturn(result)
                    .timeout(Duration.ofSeconds(1))
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
                return new ActivityInfo(record.getMetadata().getName(), s.getOperation(),
                    s.getSummary(), s.getWorkName(), s.getStatus(), s.getCreatedAt(), s.getElapsedMs());
            }).collectList().map(ActivityList::new);
    }
}
