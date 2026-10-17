package com.acanyo.halo.plugin.lingui.market;

import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;
import io.netty.channel.ChannelOption;
import java.time.Duration;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;

/** Only contacts the designated market. No caller-controlled URL or redirect is accepted. */
@Component
public class MarketClient {
    public static final String SITE = "https://auth.lik.cc";
    private static final String PUBLIC = "/apis/api.market.lingui.dev/v1alpha1/works";
    private static final String AUTHOR = "/apis/uc.api.market.lingui.dev/v1alpha1/submissions";
    private final WebClient http;
    public MarketClient() {
        this(WebClient.builder().baseUrl(SITE)
            .clientConnector(new ReactorClientHttpConnector(HttpClient.create().followRedirect(false)
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, 5000).responseTimeout(Duration.ofSeconds(15))))
            .codecs(config -> config.defaultCodecs().maxInMemorySize(12 * 1024 * 1024)).build());
    }
    MarketClient(WebClient http) { this.http = http; }
    public Mono<CommunityPage> list(int page, int size, String query) {
        return read(http.get().uri(uri -> uri.path(PUBLIC).queryParam("page", page).queryParam("size", size)
            .queryParam("query", query).build()), CommunityPage.class, false);
    }
    public Mono<CommunityDetail> get(String name) {
        return read(http.get().uri(PUBLIC + "/{name}", name), CommunityDetail.class, false);
    }
    public Mono<MarketUser> user(String token) {
        return read(http.get().uri("/apis/uc.api.halo.run/v1alpha1/users/-").headers(h -> h.setBearerAuth(token)), MarketUser.class, false);
    }
    public Mono<MyMarketPage> mine(String token, int page, int size) {
        return read(http.get().uri(uri -> uri.path(AUTHOR).queryParam("page", page).queryParam("size", size).build())
            .headers(h -> h.setBearerAuth(token)), MyMarketPage.class, false);
    }
    public Mono<MyMarketDetail> mine(String token, String name) {
        return read(http.get().uri(AUTHOR + "/{name}", name).headers(h -> h.setBearerAuth(token)), MyMarketDetail.class, false);
    }
    public Mono<MyMarketDetail> submit(String token, String name, MarketSubmitRequest request) {
        var path = name == null ? AUTHOR : AUTHOR + "/" + name + "/revisions";
        return read(http.post().uri(path).headers(h -> h.setBearerAuth(token)).contentType(MediaType.APPLICATION_JSON)
            .bodyValue(request), MyMarketDetail.class, true);
    }
    public Mono<MyMarketDetail> withdraw(String token, String name, MarketVersionRequest request) {
        return read(http.post().uri(AUTHOR + "/{name}/withdraw", name).headers(h -> h.setBearerAuth(token))
            .contentType(MediaType.APPLICATION_JSON).bodyValue(request), MyMarketDetail.class, true);
    }
    private <T> Mono<T> read(WebClient.RequestHeadersSpec<?> request, Class<T> type, boolean mutation) {
        return request.accept(MediaType.APPLICATION_JSON).exchangeToMono(response -> {
            var status = response.statusCode();
            if (status.is2xxSuccessful() && response.headers().contentType().map(t -> MediaType.APPLICATION_JSON.isCompatibleWith(t)).orElse(false))
                return response.bodyToMono(type);
            String message;
            HttpStatus result;
            if (status.value() == 401 || status.is3xxRedirection()) {
                result = HttpStatus.BAD_REQUEST; message = "市场令牌无效或已过期，请重新连接市场账号";
            } else if (status.value() == 403) {
                result = HttpStatus.FORBIDDEN; message = "市场账号或令牌没有投稿权限，请在市场站点授权后重新连接";
            } else if (status.value() == 404) {
                result = HttpStatus.NOT_FOUND; message = "市场作品不存在、已下架，或市场插件尚未启用";
            } else if (status.value() == 409) {
                result = HttpStatus.CONFLICT; message = "市场作品已更新，或版本号不符合要求，请刷新我的投稿后重试";
            } else if (status.value() == 400 || status.value() == 422) {
                result = HttpStatus.BAD_REQUEST; message = "市场未接受此作品包，请检查必填信息、组件格式和版本号";
            } else if (status.value() == 429) {
                result = HttpStatus.TOO_MANY_REQUESTS; message = "市场请求过于频繁，请稍后重试";
            } else {
                result = HttpStatus.BAD_GATEWAY; message = "市场服务暂时不可用，请稍后重试";
            }
            // Never forward an upstream body: it can contain credentials or private diagnostics.
            return response.releaseBody().then(Mono.error(new ResponseStatusException(result, message)));
        }).switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "市场返回了空响应")))
            .timeout(Duration.ofSeconds(20))
            .onErrorMap(error -> !(error instanceof ResponseStatusException), error -> new ResponseStatusException(
                HttpStatus.BAD_GATEWAY, mutation
                    ? "未能确认市场操作结果，请先刷新我的投稿核对，避免重复提交"
                    : "无法连接市场服务，请稍后重试"));
    }
}
