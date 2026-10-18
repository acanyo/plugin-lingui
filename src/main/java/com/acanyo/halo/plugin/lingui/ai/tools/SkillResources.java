package com.acanyo.halo.plugin.lingui.ai.tools;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Only bundled, explicitly named references can be read by a model. */
@Component
public class SkillResources {
    private final Map<String, String> texts;

    public SkillResources() throws IOException {
        texts = Map.of("skill", read("SKILL.md"),
            "interactions", read("references/interactions.md"),
            "theme", read("references/theme.md"), "data", read("references/data.md"),
            "layout", read("references/layout.md"),
            "examples", read("references/examples.md") + example("api-retry") + example("quiz") + example("metrics"));
    }

    private String example(String name) throws IOException {
        return "\n## " + name + "\n```json\n" + read("examples/" + name + ".json") + "```\n";
    }

    private String read(String name) throws IOException {
        try (var stream = new ClassPathResource("skills/lingui-create/" + name,
            getClass().getClassLoader()).getInputStream()) {
            return new String(stream.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    public String get(String topic) {
        var text = texts.get(topic);
        if (text == null) throw new IllegalArgumentException("未知参考，请选择 skill、interactions、theme、data、layout 或 examples");
        return text;
    }
}
