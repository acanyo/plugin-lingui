package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.mcpserver.api.McpToolAnnotations;
import run.halo.mcpserver.api.McpToolDefinition;
import run.halo.mcpserver.api.McpToolInvocation;
import run.halo.mcpserver.api.McpToolProvider;

/** Contribute the shared creation tools without owning authentication or the MCP transport. */
public final class CreationMcpToolProvider implements McpToolProvider {
    private final CreationTools tools;
    private final SavedWorkReader works;
    private final McpOwnerPermissions permissions;
    private final McpCaller caller;
    private final McpToolExecutor executor;

    public CreationMcpToolProvider(CreationTools tools, SavedWorkReader works,
        McpOwnerPermissions permissions, McpCaller caller, McpToolExecutor executor) {
        this.tools = tools;
        this.works = works;
        this.permissions = permissions;
        this.caller = caller;
        this.executor = executor;
    }

    @Override
    public Flux<McpToolDefinition> tools() {
        return Flux.fromIterable(tools.definitions()).map(definition -> McpToolDefinition.builder()
            .name(definition.name()).title(definition.name()).description(definition.description())
            .displayTitle(displayTitle(definition.name())).category("创作参考与校验")
            .inputSchema(schema(definition)).annotations(McpToolAnnotations.readOnly(definition.name()))
            .permission(invocation -> caller.canUseTools())
            .handler(invocation -> executor.execute(invocation, owner -> execute(invocation, owner)))
            .build());
    }

    private Mono<Object> execute(McpToolInvocation invocation, String owner) {
        return tools.call(invocation.toolName(), invocation.arguments(), new CreationTools.WorkContext(null,
            name -> permissions.requireWork(owner, name).then(Mono.defer(() -> works.read(name)))));
    }

    private Map<String, Object> schema(CreationTools.Definition definition) {
        if (!definition.name().equals("get_current_work")) return definition.inputSchema();
        var schema = new LinkedHashMap<>(definition.inputSchema());
        schema.put("required", List.of("workName"));
        return schema;
    }

    private String displayTitle(String name) {
        return switch (name) {
            case "search_components" -> "搜索组件";
            case "get_component_schemas" -> "读取组件参数";
            case "get_current_work" -> "读取已保存作品";
            case "get_guidance" -> "读取创作 Skill 与参考";
            case "validate_design" -> "校验设计";
            default -> name;
        };
    }
}
