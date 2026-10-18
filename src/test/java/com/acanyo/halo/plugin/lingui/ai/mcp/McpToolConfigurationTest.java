package com.acanyo.halo.plugin.lingui.ai.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpCaller;
import com.acanyo.halo.plugin.lingui.ai.mcp.access.McpOwnerPermissions;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpActivityService;
import com.acanyo.halo.plugin.lingui.ai.mcp.history.McpDraftService;
import com.acanyo.halo.plugin.lingui.ai.tools.CreationTools;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.FilteredClassLoader;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import run.halo.mcpserver.api.McpToolProvider;

class McpToolConfigurationTest {
    private ApplicationContextRunner context() {
        return new ApplicationContextRunner().withUserConfiguration(McpToolConfiguration.class)
            .withBean(McpCaller.class, () -> mock(McpCaller.class))
            .withBean(McpOwnerPermissions.class, () -> mock(McpOwnerPermissions.class))
            .withBean(McpActivityService.class, () -> mock(McpActivityService.class))
            .withBean(McpDraftService.class, () -> mock(McpDraftService.class))
            .withBean(CreationTools.class, () -> mock(CreationTools.class))
            .withBean(SavedWorkReader.class, () -> mock(SavedWorkReader.class));
    }

    @Test
    void startsWithoutTheOptionalApiAndDoesNotInstantiateProviders() {
        context().withClassLoader(new FilteredClassLoader("run.halo.mcpserver.api")).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean("creationMcpToolProvider");
            assertThat(context).doesNotHaveBean("mcpDraftToolProvider");
            assertThat(context).doesNotHaveBean("mcpToolExecutor");
            assertThat(context).hasSingleBean(McpDraftService.class).hasSingleBean(McpActivityService.class);
        });
    }

    @Test
    void registersBothProvidersWhenTheOptionalApiIsAvailable() {
        context().run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBeansOfType(McpToolProvider.class)).containsOnlyKeys(
                "creationMcpToolProvider", "mcpDraftToolProvider");
        });
    }
}
