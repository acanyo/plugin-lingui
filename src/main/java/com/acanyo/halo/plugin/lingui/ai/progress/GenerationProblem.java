package com.acanyo.halo.plugin.lingui.ai.progress;

import java.util.Map;
import org.springframework.web.server.ResponseStatusException;

/** Keep the same safe diagnostics as the non-streaming endpoint after headers are committed. */
public record GenerationProblem(int status, String detail, String category, String reference,
                                Integer providerStatus) {
    public static GenerationProblem from(ResponseStatusException error) {
        Map<String, Object> properties = error.getBody().getProperties();
        if (properties == null) properties = Map.of();
        return new GenerationProblem(error.getStatusCode().value(), error.getReason(),
            string(properties.get("category")), string(properties.get("reference")),
            properties.get("providerStatus") instanceof Number n ? n.intValue() : null);
    }
    private static String string(Object value) { return value instanceof String text ? text : null; }
}
