package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import com.acanyo.halo.plugin.lingui.ai.tools.SkillResources;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/** Stateless JSON-RPC tools and Skill resources, with an explicitly scoped external draft sink. */
@Component
public class McpProtocol {
    public static final String VERSION = "2025-11-25";
    public static final List<String> VERSIONS = List.of(VERSION, "2025-06-18", "2025-03-26");
    public static final String SKILL_URI = "lingui://skills/lingui-create/SKILL.md";
    private final CreationTools tools;
    private final SkillResources resources;
    private final SavedWorkReader works;
    private final ObjectMapper mapper = new ObjectMapper();

    public McpProtocol(CreationTools tools, SkillResources resources, SavedWorkReader works) {
        this.tools = tools;
        this.resources = resources;
        this.works = works;
    }

    public Mono<Map<String, Object>> handle(JsonNode message) {
        return handle(message, works::read, true);
    }

    public Mono<Map<String, Object>> handle(JsonNode message,
        Function<String, Mono<Object>> reader, boolean canReadWorks) {
        return handle(message, reader, canReadWorks, null);
    }

    public Mono<Map<String, Object>> handle(JsonNode message,
        Function<String, Mono<Object>> reader, boolean canReadWorks, Function<JsonNode, Mono<Object>> submitter) {
        if (!message.isObject() || !"2.0".equals(message.path("jsonrpc").asText())
            || !message.path("method").isTextual()
            || (message.has("id") && !message.path("id").isTextual() && !message.path("id").isNumber()))
            return Mono.just(error(null, -32600, "Invalid Request"));
        if (!message.has("id")) return Mono.empty();
        Object id = mapper.convertValue(message.path("id"), Object.class);
        var params = message.path("params");
        if (!params.isMissingNode() && !params.isObject()) return Mono.just(error(id, -32602, "params 必须为对象"));
        return Mono.defer(() -> dispatch(message.path("method").asText(), params, reader, canReadWorks, submitter))
            .map(result -> Map.<String, Object>of("jsonrpc", "2.0", "id", id, "result", result))
            .onErrorResume(RpcError.class, failure -> Mono.just(error(id, failure.code, failure.getMessage())))
            .onErrorResume(IllegalArgumentException.class, failure -> Mono.just(error(id, -32602, failure.getMessage())))
            .onErrorResume(failure -> Mono.just(error(id, -32603, "工具服务异常，请查看本地日志")));
    }

    private Mono<Object> dispatch(String method, JsonNode params,
        Function<String, Mono<Object>> reader, boolean canReadWorks, Function<JsonNode, Mono<Object>> submitter) {
        return switch (method) {
            case "initialize" -> {
                if (!params.path("protocolVersion").isTextual() || !params.path("capabilities").isObject()
                    || !params.path("clientInfo").path("name").isTextual()
                    || !params.path("clientInfo").path("version").isTextual())
                    throw new RpcError(-32602, "initialize 缺少 protocolVersion、capabilities 或 clientInfo");
                String requested = params.path("protocolVersion").asText();
                yield Mono.just(Map.of("protocolVersion", VERSIONS.contains(requested) ? requested : VERSION,
                    "capabilities", Map.of("tools", Map.of(), "resources", Map.of()),
                    "serverInfo", Map.of("name", "lingui-creation", "version", "1.0.0"),
                    "instructions", "读取 " + SKILL_URI + "，按需查询组件。get_current_work 需要密钥授权且必须明确 workName；授权后可用 submit_design_draft 提交待确认草稿，不能保存项目、发布或执行接口。"));
            }
            case "ping" -> Mono.just(Map.of());
            case "tools/list" -> {
                rejectCursor(params);
                var definitions = new java.util.ArrayList<Map<String, Object>>(tools.definitions().stream().filter(tool -> canReadWorks || !tool.name().equals("get_current_work")).map(tool -> Map.<String, Object>of(
                    "name", tool.name(), "description", tool.description(), "inputSchema", tool.inputSchema(),
                    "annotations", Map.of("readOnlyHint", true, "destructiveHint", false,
                        "idempotentHint", true, "openWorldHint", false))).toList());
                if (submitter != null) definitions.add(com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftTool.definition());
                yield Mono.just(Map.of("tools", definitions));
            }
            case "tools/call" -> {
                String name = params.path("name").asText();
                if (name.equals("submit_design_draft")) {
                    if (submitter == null) throw new RpcError(-32003, "此密钥未授权提交草稿，请单独开启「允许提交创作草稿」");
                    if (!params.path("arguments").isObject()) throw new RpcError(-32602, "工具 arguments 必须为对象");
                    yield submitter.apply(params.path("arguments")).map(this::toolResult);
                }
                if (name.equals("get_current_work") && !canReadWorks)
                    throw new RpcError(-32003, "此密钥未授权读取项目；请在 MCP 管理中创建授权密钥，或提供导出的作品 JSON");
                if (tools.definitions().stream().noneMatch(tool -> tool.name().equals(name)))
                    throw new RpcError(-32602, "未知工具：" + name);
                if (params.has("arguments") && !params.path("arguments").isObject())
                    throw new RpcError(-32602, "工具 arguments 必须为对象");
                Map<String, Object> args = params.has("arguments")
                    ? mapper.convertValue(params.path("arguments"), new com.fasterxml.jackson.core.type.TypeReference<>() {}) : Map.of();
                yield tools.call(name, args, new CreationTools.WorkContext(null, reader))
                    .map(result -> {
                        var json = mapper.valueToTree(result);
                        return (Object) Map.of("content", List.of(Map.of("type", "text", "text", json.toString())),
                            "structuredContent", result, "isError", json.path("isError").asBoolean(false));
                    });
            }
            case "resources/list" -> {
                rejectCursor(params);
                yield Mono.just(Map.of("resources", List.of(Map.of("uri", SKILL_URI, "name", "lingui-create",
                    "description", "交互作品创作 Skill，细节通过 get_guidance 按需读取", "mimeType", "text/markdown"))));
            }
            case "resources/read" -> {
                if (!SKILL_URI.equals(params.path("uri").asText())) throw new RpcError(-32002, "资源不存在");
                yield Mono.just(Map.of("contents", List.of(Map.of("uri", SKILL_URI, "mimeType", "text/markdown",
                    "text", resources.get("skill")))));
            }
            default -> Mono.error(new RpcError(-32601, "Method not found"));
        };
    }

    private static void rejectCursor(JsonNode params) {
        if (params.has("cursor")) throw new RpcError(-32602, "此列表无下一页");
    }

    private Object toolResult(Object result) {
        var json = mapper.valueToTree(result);
        return Map.of("content", List.of(Map.of("type", "text", "text", json.toString())),
            "structuredContent", result, "isError", json.path("isError").asBoolean(false));
    }

    public static Map<String, Object> error(Object id, int code, String message) {
        var result = new LinkedHashMap<String, Object>();
        result.put("jsonrpc", "2.0"); result.put("id", id);
        result.put("error", Map.of("code", code, "message", message));
        return result;
    }

    private static final class RpcError extends RuntimeException {
        private final int code;
        RpcError(int code, String message) { super(message); this.code = code; }
    }
}
