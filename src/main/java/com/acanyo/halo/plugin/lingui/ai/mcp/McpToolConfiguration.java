package com.acanyo.halo.plugin.lingui.ai.mcp;

import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftService;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftToolProvider;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Skip all API-linked beans when the optional official MCP Server plugin is absent. */
@Configuration(proxyBeanMethods = false)
@ConditionalOnClass(name = "run.halo.mcpserver.api.McpToolProvider")
public class McpToolConfiguration {
    @Bean
    McpToolExecutor mcpToolExecutor(McpCaller caller, McpActivityService activities) {
        return new McpToolExecutor(caller, activities);
    }

    @Bean
    CreationMcpToolProvider creationMcpToolProvider(CreationTools tools, SavedWorkReader works,
        McpOwnerPermissions permissions, McpCaller caller, McpToolExecutor executor) {
        return new CreationMcpToolProvider(tools, works, permissions, caller, executor);
    }

    @Bean
    McpDraftToolProvider mcpDraftToolProvider(McpDraftService drafts, McpCaller caller, McpToolExecutor executor) {
        return new McpDraftToolProvider(drafts, caller, executor);
    }
}
