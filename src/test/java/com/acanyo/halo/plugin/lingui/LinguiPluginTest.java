package com.acanyo.halo.plugin.lingui;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.acanyo.halo.plugin.lingui.model.DesignTheme;
import com.acanyo.halo.plugin.lingui.model.FontFamily;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import run.halo.app.extension.Scheme;
import run.halo.app.extension.SchemeManager;
import run.halo.app.plugin.PluginContext;
@ExtendWith(MockitoExtension.class)
class LinguiPluginTest {
    @Mock PluginContext context;
    @Mock SchemeManager schemes;
    @InjectMocks LinguiPlugin plugin;
    @Test void registersAndUnregistersLibraryResources() {
        plugin.start(); plugin.stop();
        verify(schemes).register(ComponentTemplate.class);
        verify(schemes).register(DesignTheme.class);
        verify(schemes).register(FontFamily.class);
        verify(schemes).register(com.acanyo.halo.plugin.lingui.model.McpDraft.class);
        verify(schemes).register(com.acanyo.halo.plugin.lingui.model.McpActivity.class);
        verify(schemes, times(5)).unregister(any(Scheme.class));
    }
}
