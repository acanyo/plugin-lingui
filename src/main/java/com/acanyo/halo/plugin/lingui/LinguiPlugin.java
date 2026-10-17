package com.acanyo.halo.plugin.lingui;

import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.acanyo.halo.plugin.lingui.model.DesignTheme;
import com.acanyo.halo.plugin.lingui.model.FontFamily;
import org.springframework.stereotype.Component;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.BasePlugin;
import run.halo.app.plugin.PluginContext;

@Component
public class LinguiPlugin extends BasePlugin {
    private final SchemeManager schemes;
    public LinguiPlugin(PluginContext context, SchemeManager schemes) {
        super(context);
        this.schemes = schemes;
    }
    @Override
    public void start() {
        schemes.register(ComponentTemplate.class);
        schemes.register(DesignTheme.class);
        schemes.register(FontFamily.class);
        schemes.register(com.acanyo.halo.plugin.lingui.model.ComponentEmbed.class);
        schemes.register(com.acanyo.halo.plugin.lingui.model.McpDraft.class);
        schemes.register(com.acanyo.halo.plugin.lingui.model.McpActivity.class);
    }
    @Override
    public void stop() {
        schemes.unregister(Scheme.buildFromType(ComponentTemplate.class));
        schemes.unregister(Scheme.buildFromType(DesignTheme.class));
        schemes.unregister(Scheme.buildFromType(FontFamily.class));
        schemes.unregister(Scheme.buildFromType(com.acanyo.halo.plugin.lingui.model.ComponentEmbed.class));
        schemes.unregister(Scheme.buildFromType(com.acanyo.halo.plugin.lingui.model.McpDraft.class));
        schemes.unregister(Scheme.buildFromType(com.acanyo.halo.plugin.lingui.model.McpActivity.class));
    }
}
