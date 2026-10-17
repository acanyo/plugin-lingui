package com.acanyo.halo.plugin.lingui.ai.progress;

import java.time.Duration;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.function.Function;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

/** One response subscription owns generation, progress, heartbeat and cancellation. */
public final class GenerationStream {
    private GenerationStream() {}

    public static Flux<GenerationEvent> create(Function<GenerationProgress, Mono<String>> generate) {
        return Flux.defer(() -> {
            var events = Sinks.many().unicast().<GenerationEvent>onBackpressureBuffer(new ArrayBlockingQueue<>(128));
            var progress = new GenerationProgress(event -> events.tryEmitNext(event));
            var result = Mono.defer(() -> {
                progress.activity("prepare", "正在连接 AI 基座", "running");
                return generate.apply(progress);
            }).switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                "AI 未返回设计，请重试")))
                .map(content -> new GenerationEvent("result", "result", "设计已返回，准备工作台校验", "done",
                progress.elapsedMs(), content, null))
                .onErrorResume(cause -> {
                    var error = cause instanceof ResponseStatusException response ? response
                        : new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI 调用失败，请重试并检查 Halo 日志");
                    return Mono.just(new GenerationEvent("error", "error", "生成未完成", "error",
                        progress.elapsedMs(), null, GenerationProblem.from(error)));
                });
            var heartbeat = Flux.interval(Duration.ofSeconds(10)).map(tick ->
                new GenerationEvent("heartbeat", null, null, null, progress.elapsedMs(), null, null));
            return Flux.merge(events.asFlux(), result.flux(), heartbeat)
                .takeUntil(GenerationEvent::terminal)
                .doFinally(signal -> events.tryEmitComplete());
        });
    }
}
