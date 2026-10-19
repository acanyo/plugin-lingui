package com.acanyo.halo.plugin.lingui.projectselection;

import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;

import io.swagger.v3.oas.annotations.enums.ParameterIn;
import java.util.Map;
import java.util.function.Supplier;
import org.springdoc.webflux.core.fn.SpringdocRouteBuilder;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.ServerRequest;
import org.springframework.web.reactive.function.server.ServerResponse;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.core.extension.endpoint.CustomEndpoint;
import run.halo.app.extension.GroupVersion;

@Component
public class ProjectOptionEndpoint implements CustomEndpoint {
    private final ProjectOptionService projects;

    public ProjectOptionEndpoint(ProjectOptionService projects) {
        this.projects = projects;
    }

    @Override
    public GroupVersion groupVersion() {
        return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1");
    }

    @Override
    public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("projectoptions", request -> respond(() -> projects.list(
                    number(request, "page", 1), number(request, "size", 20),
                    query(request, "keyword", ""), query(request, "category", ""), publicOnly(request))),
                operation -> operation.operationId("ListLinguiProjectOptions").tag("LinguiProjects")
                    .parameter(parameterBuilder().name("page").in(ParameterIn.QUERY)
                        .implementation(Integer.class).description("页码，从 1 开始，默认 1"))
                    .parameter(parameterBuilder().name("size").in(ParameterIn.QUERY)
                        .implementation(Integer.class).description("每页条数，默认 20，最多 100"))
                    .parameter(parameterBuilder().name("keyword").in(ParameterIn.QUERY)
                        .implementation(String.class).description("项目名称、ID、分类或描述关键词，最多 120 字符"))
                    .parameter(parameterBuilder().name("category").in(ParameterIn.QUERY)
                        .implementation(String.class).description("精确匹配分类，最多 80 字符"))
                    .parameter(parameterBuilder().name("publicOnly").in(ParameterIn.QUERY)
                        .implementation(Boolean.class).description("默认 true，仅返回已开启公开嵌入的项目"))
                    .response(responseBuilder().implementation(ProjectOptionList.class)))
            .GET("projectoptions/{name}", request -> respond(() -> projects.get(
                    request.pathVariable("name"), publicOnly(request))),
                operation -> operation.operationId("GetLinguiProjectOption").tag("LinguiProjects")
                    .parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true)
                        .implementation(String.class))
                    .parameter(parameterBuilder().name("publicOnly").in(ParameterIn.QUERY)
                        .implementation(Boolean.class).description("默认 true，未公开的项目返回 404"))
                    .response(responseBuilder().implementation(ProjectOption.class)))
            .build();
    }

    private static boolean publicOnly(ServerRequest request) {
        return switch (query(request, "publicOnly", "true")) {
            case "true" -> true;
            case "false" -> false;
            default -> throw bad("publicOnly 必须为 true 或 false");
        };
    }

    private static int number(ServerRequest request, String name, int fallback) {
        String value = query(request, name, Integer.toString(fallback));
        try {
            if (!value.matches("[0-9]+")) throw bad("分页参数无效");
            return Integer.parseInt(value);
        } catch (NumberFormatException error) {
            throw bad("分页参数无效");
        }
    }

    private static String query(ServerRequest request, String name, String fallback) {
        var values = request.queryParams().get(name);
        if (values == null) return fallback;
        if (values.size() != 1) throw bad("查询参数不能重复：" + name);
        return values.getFirst();
    }

    private static Mono<ServerResponse> respond(Supplier<? extends Mono<?>> action) {
        return Mono.defer(action)
            .flatMap(value -> ServerResponse.ok().header("Cache-Control", "no-store").bodyValue(value))
            .onErrorResume(ResponseStatusException.class, error -> ServerResponse.status(error.getStatusCode())
                .header("Cache-Control", "no-store")
                .bodyValue(Map.of("message", error.getReason() == null ? "组件暂时无法加载" : error.getReason())));
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
