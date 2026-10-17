package com.acanyo.halo.plugin.lingui.theme;

import org.springframework.stereotype.Component;
import org.thymeleaf.context.ITemplateContext;
import org.thymeleaf.model.IModel;
import org.thymeleaf.processor.element.IElementModelStructureHandler;
import reactor.core.publisher.Mono;
import run.halo.app.plugin.PluginContext;
import run.halo.app.theme.dialect.TemplateHeadProcessor;

@Component
public class LinguiHeadProcessor implements TemplateHeadProcessor {
    private final PluginContext plugin;
    public LinguiHeadProcessor(PluginContext plugin) { this.plugin = plugin; }
    @Override
    public Mono<Void> process(ITemplateContext context, IModel model,
        IElementModelStructureHandler handler) {
        model.add(context.getModelFactory().createText(
            "<link rel=\"stylesheet\" href=\"/plugins/" + plugin.getName()
                + "/assets/reader/lingui-reader.css?v=" + plugin.getVersion() + "\"><script defer src=\"/plugins/" + plugin.getName()
                + "/assets/reader/lingui-loader.js?v=" + plugin.getVersion() + "\"></script>"));
        return Mono.empty();
    }
}
