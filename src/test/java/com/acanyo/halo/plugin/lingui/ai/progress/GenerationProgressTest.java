package com.acanyo.halo.plugin.lingui.ai.progress;

import static org.junit.jupiter.api.Assertions.*;

import java.util.ArrayList;
import java.util.Map;
import org.junit.jupiter.api.Test;
import run.halo.aifoundation.chat.GenerationStep;
import run.halo.aifoundation.lifecycle.*;
import run.halo.aifoundation.tool.ToolResult;

class GenerationProgressTest {
    @Test
    void retainsTheOriginalFailureWithoutEmittingPrivateErrorText() {
        var events = new ArrayList<GenerationEvent>();
        var progress = new GenerationProgress(events::add);
        var flattened = new IllegalStateException("private-provider-message");
        var original = new java.net.ConnectException("private-provider-address");
        assertSame(flattened, progress.failureOr(flattened));

        progress.onError(GenerationErrorEvent.builder().error(original).build()).block();
        progress.onError(GenerationErrorEvent.builder().error(flattened).build()).block();

        assertSame(original, progress.failureOr(flattened));
        assertTrue(events.isEmpty());
        assertSame(flattened, new GenerationProgress().failureOr(flattened));
    }

    @Test
    void mapsRealLifecycleToSafeCorrelatedStepsAndFlagsValidationFailures() {
        var events = new ArrayList<GenerationEvent>();
        var progress = new GenerationProgress(events::add);
        progress.onStepStart(GenerationStepStartEvent.builder().stepIndex(0).build()).block();
        progress.onToolCallStart(GenerationToolCallStartEvent.builder().stepIndex(0)
            .toolCallId("private-provider-id").toolName("validate_design")
            .input(Map.of("design", "private-user-design")).build()).block();
        progress.onToolCallFinish(GenerationToolCallFinishEvent.builder().stepIndex(0)
            .toolCallId("private-provider-id").result(ToolResult.builder()
                .result(Map.of("valid", false, "errors", "private-user-design")).build()).build()).block();
        assertEquals("prepare", events.getFirst().id());
        assertEquals("model-0", events.get(1).id());
        assertEquals("done", events.get(2).state());
        assertEquals("running", events.get(3).state());
        assertEquals(events.get(3).id(), events.get(4).id());
        assertEquals("warning", events.getLast().state());
        assertFalse(events.toString().contains("private"));

        progress.onStepStart(GenerationStepStartEvent.builder().stepIndex(1).build()).block();
        progress.onStepFinish(GenerationStepFinishEvent.builder().stepIndex(1)
            .step(GenerationStep.builder().text("private-design").reasoningText("private-reasoning").build())
            .build()).block();
        assertEquals("model-1", events.getLast().id());
        assertEquals("done", events.getLast().state());
        assertFalse(events.toString().contains("private"));
    }

    @Test
    void finishesModelTimingEvenWhenAToolCannotStart() {
        var events = new ArrayList<GenerationEvent>();
        var progress = new GenerationProgress(events::add);
        progress.onStepStart(GenerationStepStartEvent.builder().stepIndex(2).build()).block();
        progress.onStepFinish(GenerationStepFinishEvent.builder().stepIndex(2)
            .step(GenerationStep.builder()
                .toolCalls(java.util.List.of(run.halo.aifoundation.tool.ToolCall.builder().toolName("unknown").build()))
                .toolErrors(java.util.List.of(run.halo.aifoundation.tool.ToolError.builder().build())).build()).build()).block();
        assertEquals("model-2", events.getLast().id());
        assertEquals("warning", events.getLast().state());
        assertTrue(events.getLast().label().contains("未执行"));
    }

    @Test
    void concurrentRequestsDoNotShareSteps() {
        var first = new ArrayList<GenerationEvent>();
        var second = new ArrayList<GenerationEvent>();
        new GenerationProgress(first::add).onStepStart(GenerationStepStartEvent.builder().stepIndex(2).build()).block();
        new GenerationProgress(second::add).onStepStart(GenerationStepStartEvent.builder().stepIndex(0).build()).block();
        assertEquals("model-2", first.getLast().id());
        assertEquals("model-0", second.getLast().id());
    }

    @Test
    void outputRepairContinuesTheTimelineWithoutOverwritingTheOriginalSteps() {
        var events = new ArrayList<GenerationEvent>();
        var progress = new GenerationProgress(events::add);
        progress.onStepStart(GenerationStepStartEvent.builder().stepIndex(0).build()).block();
        progress.onStepFinish(GenerationStepFinishEvent.builder().stepIndex(0)
            .step(GenerationStep.builder().text("invalid output").build()).build()).block();
        progress.nextAttempt(1);
        progress.onStepStart(GenerationStepStartEvent.builder().stepIndex(0).build()).block();
        assertEquals("model-1", events.getLast().id());
        assertTrue(events.getLast().label().contains("第 2 轮"));
        progress.onStepFinish(GenerationStepFinishEvent.builder().stepIndex(0)
            .step(GenerationStep.builder().build()).build()).block();
        assertEquals("model-1", events.getLast().id());
        assertEquals("done", events.getLast().state());
    }
}
