package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.function.Function;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.mcpserver.api.McpToolInvocation;
import run.halo.mcpserver.api.McpToolResult;

/** Adapt business results and expected failures while keeping activity storage protocol independent. */
public final class McpToolExecutor {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(McpToolExecutor.class);
    private final McpCaller caller;
    private final McpActivityService activities;
    private final ObjectMapper mapper = new ObjectMapper();

    public McpToolExecutor(McpCaller caller, McpActivityService activities) {
        this.caller = caller;
        this.activities = activities;
    }

    public Mono<McpToolResult> execute(McpToolInvocation invocation, Function<String, Mono<Object>> action) {
        return caller.owner().flatMap(owner -> activities.trace(owner, invocation.toolName(), invocation.arguments(),
            () -> Mono.defer(() -> action.apply(owner))
                .map(result -> mapper.convertValue(result, new TypeReference<Map<String, Object>>() {}))
                .onErrorResume(error -> Mono.just(failure(error)))))
            .map(result -> Boolean.TRUE.equals(result.get("isError"))
                ? McpToolResult.error(String.valueOf(result.getOrDefault("code", "INVALID_ARGUMENT")),
                    String.valueOf(result.getOrDefault("message", "工具调用失败")))
                : McpToolResult.success(result))
            .onErrorResume(ResponseStatusException.class, error -> {
                var result = failure(error);
                return Mono.just(McpToolResult.error((String) result.get("code"), (String) result.get("message")));
            });
    }

    private Map<String, Object> failure(Throwable error) {
        if (error instanceof ResponseStatusException status) {
            String code = switch (status.getStatusCode().value()) {
                case 401, 403 -> "FORBIDDEN";
                case 404 -> "NOT_FOUND";
                case 400 -> "INVALID_ARGUMENT";
                default -> "INTERNAL";
            };
            if (!code.equals("INTERNAL")) return Map.of("isError", true, "code", code,
                "message", status.getReason() == null ? "工具调用被拒绝" : status.getReason());
        }
        if (error instanceof IllegalArgumentException) return Map.of("isError", true,
            "code", "INVALID_ARGUMENT", "message", error.getMessage() == null ? "工具参数无效" : error.getMessage());
        LOG.warn("Lingui contributed MCP tool failed", error);
        return Map.of("isError", true, "code", "INTERNAL", "message", "工具服务异常，请查看 Halo 日志");
    }
}
