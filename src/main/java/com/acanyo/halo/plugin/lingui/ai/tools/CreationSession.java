package com.acanyo.halo.plugin.lingui.ai.tools;

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import run.halo.aifoundation.tool.ToolDefinition;

/** Request-scoped final artifact; a successful final validation ends the tool loop. */
public record CreationSession(List<ToolDefinition> tools, AtomicReference<String> validatedDesign,
    java.util.function.Function<String, String> validateOutput) {
    public boolean complete() { return validatedDesign.get() != null; }
    public String output() { return validatedDesign.get(); }
}
