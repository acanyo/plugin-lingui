package com.acanyo.halo.plugin.lingui.ai;

import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.UUID;
import java.util.concurrent.TimeoutException;
import java.util.regex.Pattern;
import javax.net.ssl.SSLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.buffer.DataBufferLimitException;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import run.halo.aifoundation.exception.AiGenerationTimeoutException;
import run.halo.aifoundation.exception.DefaultModelNotConfiguredException;
import run.halo.aifoundation.exception.IncompatibleModelTypeException;
import run.halo.aifoundation.exception.ModelDisabledException;
import run.halo.aifoundation.exception.ModelNotFoundException;
import run.halo.aifoundation.exception.ProviderApiException;
import run.halo.aifoundation.exception.ProviderDisabledException;

/** Turns provider failures into actionable diagnostics without exposing response bodies or secrets. */
final class AiGenerationErrors {
    private static final Logger LOG = LoggerFactory.getLogger(AiGenerationErrors.class);
    // Foundation's transport exception is internal to its app, so match its exact name without
    // linking against that implementation class. Older streams flatten it to IllegalStateException.
    private static final String PROVIDER_HTTP_EXCEPTION =
        "run.halo.aifoundation.provider.transport.ProviderHttpException";
    private static final Pattern COMPATIBLE_STATUS = Pattern.compile(
        "^(?:OpenAI|openai)-compatible chat request failed: status=([1-5][0-9]{2})(?:,|\\z)");

    private AiGenerationErrors() {}

    static ResponseStatusException translate(Throwable error) {
        return translate(classify(error));
    }

    static ResponseStatusException outputLimit() {
        return translate(new Failure(HttpStatus.BAD_GATEWAY, "output-limit", 0,
            "run.halo.aifoundation.chat.FinishReason.LENGTH",
            "AI 输出达到模型长度上限，完整组件尚未生成。请在灵构 UI 的 AI 设置中提高输出 Token 预算，或缩小需求后重试"));
    }

    static ResponseStatusException deadline(java.time.Duration timeout) {
        return translate(new Failure(HttpStatus.GATEWAY_TIMEOUT, "timeout", 0,
            "java.util.concurrent.TimeoutException",
            "AI 生成已达到本次 " + timeout.toMinutes() + " 分钟总时限，尚未完成有效设计。当前作品与对话已保留，可查看执行记录后重试"));
    }

    static ResponseStatusException invalidDesign(String issue) {
        return translate(new Failure(HttpStatus.BAD_GATEWAY, "invalid-design", 0,
            "com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator",
            "AI 返回内容未通过作品校验：" + (issue == null ? "需要有效的作品 JSON" : issue)
                + "。当前作品已保留，可重试生成"));
    }

    static ResponseStatusException toolLimit() {
        return toolLimit(null);
    }

    static ResponseStatusException toolLimit(String issue) {
        return translate(new Failure(HttpStatus.BAD_GATEWAY, "tool-limit", 0,
            "com.acanyo.halo.plugin.lingui.ai.tools.CreationSession",
            "AI 工具调用轮次已用完，模型仍未提交通过校验的设计。"
                + (issue == null || issue.isBlank() ? "" : "最近校验问题：" + issue + "。")
                + "当前作品已保留，可查看执行过程与诊断编号后重试"));
    }

    private static ResponseStatusException translate(Failure failure) {
        var reference = UUID.randomUUID().toString().substring(0, 8);
        // Do not log the exception or its message: provider errors may embed credentials or prompts.
        LOG.warn("Lingui AI generation failed: reference={}, category={}, providerStatus={}, cause={}",
            reference, failure.category(), failure.providerStatus(), failure.causeType());
        var error = new ResponseStatusException(failure.status(),
            failure.reason() + "（诊断编号：" + reference + "）");
        error.getBody().setProperty("category", failure.category());
        error.getBody().setProperty("reference", reference);
        if (failure.providerStatus() > 0) {
            error.getBody().setProperty("providerStatus", failure.providerStatus());
        }
        return error;
    }

    static Failure classify(Throwable error) {
        var visited = Collections.newSetFromMap(new IdentityHashMap<Throwable, Boolean>());
        for (var cause = error; cause != null && visited.size() < 16 && visited.add(cause);
            cause = cause.getCause()) {
            if (cause instanceof DefaultModelNotConfiguredException) {
                return failure(HttpStatus.BAD_REQUEST, "default-model", 0, cause,
                    "AI 基座尚未配置默认语言模型，请在基座中设置默认模型，或在灵构 UI 工作台中选择模型");
            }
            if (cause instanceof IllegalArgumentException && cause.getMessage() != null
                && (cause.getMessage().startsWith("Tool calling is not supported by provider type:")
                    || cause.getMessage().startsWith("toolChoice REQUIRED is not supported by provider type:"))) {
                return failure(HttpStatus.BAD_REQUEST, "tools-unsupported", 0, cause,
                    "当前 AI 基座模型或服务商不支持工具调用，请选择支持 Function Calling 的语言模型后重试");
            }
            if (cause instanceof ModelNotFoundException || cause instanceof ModelDisabledException
                || cause instanceof ProviderDisabledException || cause instanceof IncompatibleModelTypeException) {
                return failure(HttpStatus.BAD_REQUEST, "model-unavailable", 0, cause,
                    "所选 AI 基座语言模型不存在、不可用或类型不匹配，请在工作台重新选择可用模型");
            }
            if (cause instanceof ProviderApiException provider) {
                return providerFailure(provider.getStatusCode(), cause);
            }
            if (cause instanceof WebClientResponseException response) {
                return providerFailure(response.getStatusCode().value(), cause);
            }
            if ((cause instanceof IllegalStateException
                || PROVIDER_HTTP_EXCEPTION.equals(cause.getClass().getName()))
                && cause.getMessage() != null) {
                var match = COMPATIBLE_STATUS.matcher(cause.getMessage());
                if (match.find()) return providerFailure(Integer.parseInt(match.group(1)), cause);
            }
            if (cause instanceof TimeoutException || cause instanceof AiGenerationTimeoutException
                || cause instanceof SocketTimeoutException) {
                return failure(HttpStatus.GATEWAY_TIMEOUT, "timeout", 0, cause,
                    "AI 生成超时，请缩小需求或切换 AI 基座模型后重试");
            }
            if (cause instanceof ConnectException || cause instanceof UnknownHostException
                || cause instanceof SSLException) {
                return failure(HttpStatus.BAD_GATEWAY, "connection", 0, cause,
                    "Halo 无法连接 AI 服务商，请检查服务器网络、服务商地址和 HTTPS 证书后重试");
            }
            if (cause instanceof DataBufferLimitException) {
                return failure(HttpStatus.BAD_GATEWAY, "response-limit", 0, cause,
                    "AI 服务商响应超过基座接收上限，请缩小需求或切换模型后重试");
            }
        }
        return failure(HttpStatus.BAD_GATEWAY, "unknown", 0, error,
            "AI 调用失败，请重试；若仍失败，请根据诊断编号查看 Halo 日志");
    }

    private static Failure providerFailure(int status, Throwable cause) {
        var reason = switch (status) {
            case 401 -> "AI 服务商认证失败（HTTP 401），请在 AI 基座中检查凭据是否有效";
            case 403 -> "AI 服务商拒绝访问（HTTP 403），请检查所选模型的账号权限";
            case 404 -> "AI 服务商接口或模型不存在（HTTP 404），请检查基座中的接口地址和模型 ID";
            case 408, 504 -> "AI 服务商响应超时（HTTP " + status + "），请稍后重试或切换模型";
            case 413 -> "AI 服务商拒绝过大的请求（HTTP 413），请缩小组件或分步修改";
            case 429 -> "AI 服务商限流或额度不足（HTTP 429），请稍后重试并检查账号额度";
            case 503 -> "AI 服务商暂时异常（HTTP 503），当前模型或服务渠道不可用，请在工作台切换模型，或在 AI 基座中检查服务商与模型配置后重试";
            case 400, 422 -> "AI 服务商拒绝生成参数或内容（HTTP " + status
                + "），请检查模型接口兼容性、上下文和输出长度限制，或切换模型后重试";
            default -> status >= 500
                ? "AI 服务商暂时异常（HTTP " + status + "），请稍后重试或切换模型"
                : "AI 服务商调用失败，请在 AI 基座中检查模型的调用配置后重试";
        };
        var responseStatus = switch (status) {
            case 429 -> HttpStatus.TOO_MANY_REQUESTS;
            case 408, 504 -> HttpStatus.GATEWAY_TIMEOUT;
            default -> HttpStatus.BAD_GATEWAY;
        };
        return failure(responseStatus, "provider-http", status, cause, reason);
    }

    private static Failure failure(HttpStatus status, String category, int providerStatus,
        Throwable cause, String reason) {
        return new Failure(status, category, providerStatus, cause.getClass().getName(), reason);
    }

    record Failure(HttpStatus status, String category, int providerStatus, String causeType,
        String reason) {}
}
