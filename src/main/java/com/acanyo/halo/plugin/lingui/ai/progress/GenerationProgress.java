package com.acanyo.halo.plugin.lingui.ai.progress;

import java.util.HashMap;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Mono;
import run.halo.aifoundation.lifecycle.GenerationErrorEvent;
import run.halo.aifoundation.lifecycle.GenerationLifecycle;
import run.halo.aifoundation.lifecycle.GenerationStepFinishEvent;
import run.halo.aifoundation.lifecycle.GenerationStepStartEvent;
import run.halo.aifoundation.lifecycle.GenerationToolCallFinishEvent;
import run.halo.aifoundation.lifecycle.GenerationToolCallStartEvent;

/** Maps Foundation lifecycle events to a bounded, request-local execution timeline. */
public final class GenerationProgress implements GenerationLifecycle {
    private final long started = System.nanoTime();
    private final Consumer<GenerationEvent> consumer;
    private final Map<String, String> toolIds = new HashMap<>();
    private final Map<String, String> labels = new HashMap<>();
    private final Set<Integer> awaitingModel = new HashSet<>();
    private boolean connected;
    private Throwable failure;

    public GenerationProgress(Consumer<GenerationEvent> consumer) { this.consumer = consumer; }
    public GenerationProgress() { this(event -> {}); }
    public long elapsedMs() { return (System.nanoTime() - started) / 1_000_000; }

    /** Foundation 1.0.0's stream result loses the original exception type and cause. */
    public synchronized Throwable failureOr(Throwable streamFailure) {
        return failure == null ? streamFailure : failure;
    }

    @Override public synchronized Mono<Void> onError(GenerationErrorEvent event) {
        if (failure == null) failure = event.getError();
        return Mono.empty();
    }

    public synchronized void activity(String id, String label, String state) {
        consumer.accept(new GenerationEvent("activity", id, label, state, elapsedMs(), null, null));
    }
    @Override public synchronized Mono<Void> onStepStart(GenerationStepStartEvent event) {
        if (!connected) {
            activity("prepare", "已连接 AI 基座", "done");
            connected = true;
        }
        awaitingModel.add(event.getStepIndex());
        activity("model-" + event.getStepIndex(), "模型生成设计 · 第 " + (event.getStepIndex() + 1) + " 轮", "running");
        return Mono.empty();
    }
    @Override public synchronized Mono<Void> onToolCallStart(GenerationToolCallStartEvent event) {
        if (awaitingModel.remove(event.getStepIndex()))
            activity("model-" + event.getStepIndex(), "模型返回工具调用 · 第 " + (event.getStepIndex() + 1) + " 轮", "done");
        String key = event.getStepIndex() + ":" + event.getToolCallId();
        String id = toolIds.computeIfAbsent(key, ignored -> "tool-" + toolIds.size());
        String label = switch (event.getToolName()) {
            case "search_components" -> "查询可用组件";
            case "get_component_schemas" -> "读取组件参数与约束";
            case "get_current_work" -> "读取当前作品快照";
            case "get_guidance" -> switch (String.valueOf(event.getInput() == null ? null : event.getInput().get("topic"))) {
                case "interactions" -> "读取交互规则";
                case "theme" -> "读取主题规则";
                case "data" -> "读取数据绑定规则";
                default -> "读取创作规则";
            };
            case "validate_design" -> "校验组件、状态与交互";
            default -> "执行创作工具";
        };
        labels.put(id, label);
        activity(id, label, "running");
        return Mono.empty();
    }
    @Override public synchronized Mono<Void> onToolCallFinish(GenerationToolCallFinishEvent event) {
        String id = toolIds.get(event.getStepIndex() + ":" + event.getToolCallId());
        if (id == null) return Mono.empty();
        Object result = event.getResult() == null ? null : event.getResult().getResult();
        boolean invalid = result instanceof Map<?, ?> map
            && (Boolean.TRUE.equals(map.get("isError")) || Boolean.FALSE.equals(map.get("valid")));
        boolean failed = event.getError() != null || invalid;
        String issue = "需要修正";
        if (invalid && result instanceof Map<?, ?> map) {
            Object value = map.get("message");
            if (map.get("issues") instanceof java.util.List<?> issues && !issues.isEmpty()
                && issues.getFirst() instanceof Map<?, ?> first) value = first.get("message");
            if (value instanceof String message && !message.isBlank()) {
                String summary = message.replaceAll("[\\r\\n]+", " ");
                issue = summary.substring(0, Math.min(summary.length(), 110));
            }
        }
        activity(id, failed ? labels.get(id) + " · " + issue : labels.get(id) + " · 完成", failed ? "warning" : "done");
        return Mono.empty();
    }
    @Override public synchronized Mono<Void> onStepFinish(GenerationStepFinishEvent event) {
        var calls = event.getStep().getToolCalls();
        if (awaitingModel.remove(event.getStepIndex())) {
            var errors = event.getStep().getToolErrors();
            boolean failed = errors != null && !errors.isEmpty();
            String label = failed ? "模型工具调用未执行 · 需要修正"
                : calls == null || calls.isEmpty() ? "模型已返回设计" : "模型已返回工具调用";
            activity("model-" + event.getStepIndex(), label + " · 第 " + (event.getStepIndex() + 1) + " 轮",
                failed ? "warning" : "done");
        }
        LoggerFactory.getLogger(GenerationProgress.class).info("Lingui AI step completed: step={}, finish={}, toolCalls={}",
            event.getStepIndex(), event.getStep().getFinishReason(), calls == null ? 0 : calls.size());
        return Mono.empty();
    }
}
