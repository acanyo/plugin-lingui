package com.acanyo.halo.plugin.lingui.ai.progress;

import io.swagger.v3.oas.annotations.media.Schema;

/** Public execution facts only: no reasoning, prompts, tool arguments, credentials or raw results. */
public record GenerationEvent(
    @Schema(allowableValues = {"activity", "heartbeat", "result", "error"}) String type,
    String id,
    String label,
    @Schema(allowableValues = {"running", "done", "warning", "error"}) String state,
    long elapsedMs,
    String content,
    GenerationProblem problem) {
    public boolean terminal() { return "result".equals(type) || "error".equals(type); }
}
