package com.acanyo.halo.plugin.lingui.market;

import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;
import static org.springdoc.core.fn.builders.apiresponse.Builder.responseBuilder;
import static org.springdoc.core.fn.builders.parameter.Builder.parameterBuilder;
import static org.springdoc.core.fn.builders.requestbody.Builder.requestBodyBuilder;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import java.nio.charset.StandardCharsets;
import java.util.function.Consumer;
import org.springdoc.core.fn.builders.operation.Builder;
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
public class MarketEndpoint implements CustomEndpoint {
    private final MarketClient market;
    private final MarketCredentials credentials;
    private final MarketCatalog catalog;
    public MarketEndpoint(MarketClient market, MarketCredentials credentials, MarketCatalog catalog) {
        this.market = market; this.credentials = credentials; this.catalog = catalog;
    }
    @Override public GroupVersion groupVersion() { return GroupVersion.parseAPIVersion("console.api.lingui.acanyo.com/v1alpha1"); }
    @Override public RouterFunction<ServerResponse> endpoint() {
        return SpringdocRouteBuilder.route()
            .GET("marketworks", r -> ok(catalog.list(page(r), size(r), query(r), kind(r))), op("ListCommunityWorks", CommunityPage.class, null, false, true))
            .GET("marketworks/{name}", r -> ok(market.get(name(r))), op("GetCommunityWork", CommunityDetail.class, null, true, false))
            .GET("marketconnection", r -> ok(actor(r).flatMap(credentials::status)), op("GetMarketConnection", MarketConnection.class, null, false, false))
            .PUT("marketconnection", r -> ok(actor(r).flatMap(a -> r.bodyToMono(MarketConnectRequest.class).flatMap(v -> credentials.connect(a, v)))),
                op("ConnectMarketAccount", MarketConnection.class, MarketConnectRequest.class, false, false))
            .DELETE("marketconnection", r -> actor(r).flatMap(credentials::disconnect).then(ServerResponse.noContent().build()),
                op("DisconnectMarketAccount", null, null, false, false))
            .GET("marketsubmissions", r -> ok(token(r).flatMap(t -> market.mine(t, page(r), size(r)))), op("ListRemoteSubmissions", MyMarketPage.class, null, false, true))
            .GET("marketsubmissions/{name}", r -> ok(token(r).flatMap(t -> market.mine(t, name(r)))), op("GetRemoteSubmission", MyMarketDetail.class, null, true, false))
            .POST("marketsubmissions", r -> ok(token(r).flatMap(t -> submission(r, false).flatMap(v -> market.submit(t, null, v)))),
                op("SendMarketSubmission", MyMarketDetail.class, MarketSubmitRequest.class, false, false))
            .POST("marketsubmissions/{name}/revisions", r -> ok(token(r).flatMap(t -> submission(r, true).flatMap(v -> market.submit(t, name(r), v)))),
                op("SendMarketRevision", MyMarketDetail.class, MarketSubmitRequest.class, true, false))
            .POST("marketsubmissions/{name}/withdraw", r -> ok(token(r).flatMap(t -> r.bodyToMono(MarketVersionRequest.class).flatMap(v -> {
                requireVersion(v.expectedVersion()); return market.withdraw(t, name(r), v);
            }))), op("WithdrawRemoteSubmission", MyMarketDetail.class, MarketVersionRequest.class, true, false))
            .build();
    }
    private Mono<String> token(ServerRequest r) { return actor(r).flatMap(credentials::token); }
    private static Mono<String> actor(ServerRequest r) {
        return r.principal().map(java.security.Principal::getName).filter(n -> !n.equals("anonymousUser"))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录工作台")));
    }
    private static Mono<MarketSubmitRequest> submission(ServerRequest r, boolean revision) {
        return r.bodyToMono(MarketSubmitRequest.class).map(v -> {
            if (v.packageJson() == null || v.packageJson().isBlank()) throw bad("作品包不能为空");
            if (v.packageJson().getBytes(StandardCharsets.UTF_8).length > 524288) throw bad("作品包不能超过 512 KiB");
            if (revision) requireVersion(v.expectedVersion());
            return v;
        });
    }
    private static void requireVersion(Long v) { if (v == null || v < 0) throw bad("请刷新投稿详情后重试"); }
    private static String name(ServerRequest r) {
        var name = r.pathVariable("name");
        if (!name.matches("work-[a-zA-Z0-9-]{1,100}")) throw bad("作品标识无效");
        return name;
    }
    private static int page(ServerRequest r) { return number(r, "page", 1, 100000); }
    private static int size(ServerRequest r) { return number(r, "size", 9, 50); }
    private static int number(ServerRequest r, String key, int fallback, int max) {
        try { var v = Integer.parseInt(r.queryParam(key).orElse(String.valueOf(fallback))); if (v < 1 || v > max) throw bad("分页参数无效"); return v; }
        catch (NumberFormatException e) { throw bad("分页参数无效"); }
    }
    private static String query(ServerRequest r) { var q = r.queryParam("query").orElse("").trim(); if (q.length() > 120) throw bad("关键词过长"); return q; }
    private static String kind(ServerRequest r) {
        String kind = r.queryParam("kind").orElse("");
        if (!kind.isEmpty() && !kind.equals("component") && !kind.equals("theme")) throw bad("作品类型无效");
        return kind;
    }
    private static ResponseStatusException bad(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
    private static Mono<ServerResponse> ok(Mono<?> value) { return value.flatMap(v -> ServerResponse.ok().header("Cache-Control", "no-store").bodyValue(v)); }
    private static Consumer<Builder> op(String id, Class<?> output, Class<?> input, boolean name, boolean page) {
        return b -> {
            b.operationId(id).tag("LinguiMarket").response(output == null ? responseBuilder().responseCode("204") : responseBuilder().implementation(output));
            if (input != null) b.requestBody(requestBodyBuilder().implementation(input));
            if (name) b.parameter(parameterBuilder().name("name").in(ParameterIn.PATH).required(true));
            if (page) {
                b.parameter(parameterBuilder().name("page").in(ParameterIn.QUERY).implementation(Integer.class))
                    .parameter(parameterBuilder().name("size").in(ParameterIn.QUERY).implementation(Integer.class));
                if (id.equals("ListCommunityWorks")) b.parameter(parameterBuilder().name("query").in(ParameterIn.QUERY))
                    .parameter(parameterBuilder().name("kind").in(ParameterIn.QUERY)
                        .description("按作品类型筛选：component 或 theme；省略时兼容全部作品列表"));
            }
        };
    }
}
