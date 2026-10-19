package com.acanyo.halo.plugin.lingui.ai;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.requestbody.Builder.requestBodyBuilder;
import io.swagger.v3.oas.annotations.media.Schema;
import org.springdoc.webflux.core.fn.SpringdocRouteBuilder;
import org.springframework.stereotype.Component;
import org.springframework.http.MediaType;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerResponse;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;
import org.springframework.http.codec.ServerSentEvent;
import com.acanyo.halo.plugin.lingui.ai.progress.GenerationEvent;

@Component
public class AiEndpoint implements CustomEndpoint {
    private final AiService service;
    public AiEndpoint(AiService service) { this.service = service; }
    @Override
    public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("generation-settings", request -> service.generationSettings()
                .flatMap(config -> ServerResponse.ok().bodyValue(config)),
                builder -> builder.operationId("GetLinguiGenerationSettings").tag("LinguiAi")
                    .description("读取兼容旧插件配置的工作台初始模型，仅返回模型资源名称")
                    .response(responseBuilder().implementation(GenerationSettings.class)))
            .POST("generate", request -> request.bodyToMono(GenerateRequest.class)
            .flatMap(input -> request.headers().accept().stream().anyMatch(type -> type.getQualityValue() > 0
                && !type.isWildcardType() && !type.isWildcardSubtype() && type.isCompatibleWith(MediaType.TEXT_EVENT_STREAM))
                ? ServerResponse.ok().contentType(MediaType.TEXT_EVENT_STREAM)
                    .header("Cache-Control", "no-cache, no-transform").header("X-Accel-Buffering", "no")
                    .body(service.generateEvents(input).map(event -> ServerSentEvent.builder(event)
                        .event(event.type()).build()), ServerSentEvent.class)
                : service.generate(input).flatMap(content -> ServerResponse.ok().bodyValue(new GenerateResponse(content))))
            .onErrorResume(ResponseStatusException.class, error -> ServerResponse.status(error.getStatusCode())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON).bodyValue(error.getBody())),
            builder -> builder.operationId("GenerateLinguiComponent").tag("LinguiAi")
                .description("生成或修改离线组件定义，返回内容需在客户端通过完整协议与安全校验")
                .requestBody(requestBodyBuilder().implementation(GenerateRequest.class))
                .response(responseBuilder().content(org.springdoc.core.fn.builders.content.Builder.contentBuilder()
                    .mediaType(MediaType.APPLICATION_JSON_VALUE).schema(org.springdoc.core.fn.builders.schema.Builder.schemaBuilder().implementation(GenerateResponse.class)))
                    .content(org.springdoc.core.fn.builders.content.Builder.contentBuilder()
                        .mediaType(MediaType.TEXT_EVENT_STREAM_VALUE).schema(org.springdoc.core.fn.builders.schema.Builder.schemaBuilder().implementation(GenerationEvent.class)))))
            .POST("generate-theme", request -> request.bodyToMono(GenerateThemeRequest.class)
                .flatMap(service::generateTheme)
                .flatMap(content -> ServerResponse.ok().bodyValue(new GenerateResponse(content)))
                .onErrorResume(ResponseStatusException.class, error -> ServerResponse.status(error.getStatusCode())
                    .contentType(MediaType.APPLICATION_PROBLEM_JSON).bodyValue(error.getBody())),
                builder -> builder.operationId("GenerateLinguiTheme").tag("LinguiAi")
                    .description("生成或修改组件主题，返回内容需在客户端通过完整主题协议校验")
                    .requestBody(requestBodyBuilder().implementation(GenerateThemeRequest.class))
                    .response(responseBuilder().implementation(GenerateResponse.class))).build();
    }
    @Override
    public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1"); }
    public record GenerateRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 4000) String instruction,
        @Schema(maxLength = 262144) String document,
        @Schema(maxLength = 160, nullable = true, description = "工作台选择的模型资源名称；省略或 null 兼容旧插件设置，空字符串使用 AI 基座默认语言模型") String modelName) {
        public GenerateRequest(String instruction, String document) {
            this(instruction, document, null);
        }
    }
    public record GenerateResponse(String content) {}
    public record GenerationSettings(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "旧插件配置中的模型资源名称，空字符串表示 AI 基座默认语言模型") String modelName) {}
    public record GenerateThemeRequest(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, minLength = 1, maxLength = 4000) String instruction,
        @Schema(maxLength = 8192) String theme,
        @Schema(maxLength = 160, nullable = true, description = "工作台选择的模型资源名称；省略或 null 兼容旧插件设置，空字符串使用 AI 基座默认语言模型") String modelName) {
        public GenerateThemeRequest(String instruction, String theme) {
            this(instruction, theme, null);
        }
    }
}
