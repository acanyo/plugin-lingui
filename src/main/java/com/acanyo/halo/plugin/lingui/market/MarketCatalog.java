package com.acanyo.halo.plugin.lingui.market;

import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;

/** Groups before pagination, including markets whose summaries predate the package kind field. */
@Component
public final class MarketCatalog {
    private final MarketClient market;
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, String> kinds = new LinkedHashMap<>(64, .75f, true);

    public MarketCatalog(MarketClient market) { this.market = market; }

    public Mono<CommunityPage> list(int page, int size, String query, String kind) {
        if (kind.isEmpty()) return market.list(page, size, query);
        return market.list(1, 50, query)
            .expand(result -> {
                if (result.total() > 5000) return Mono.error(unavailable("市场作品过多，请缩小搜索范围"));
                if (result.page() < 1 || result.page() > 100 || result.size() < 1 || result.size() > 50)
                    return Mono.error(unavailable("市场分页信息无效，请刷新重试"));
                return (long) result.page() * result.size() < result.total()
                    ? market.list(result.page() + 1, 50, query) : Mono.empty();
            })
            .concatMapIterable(result -> result.items() == null ? java.util.List.of() : result.items())
            .distinct(CommunityWork::name)
            .flatMapSequential(work -> kind(work).map(type -> new TypedWork(work, type)), 4, 1)
            .collectList().map(all -> {
                long components = all.stream().filter(work -> work.kind().equals("component")).count();
                var matching = all.stream().filter(work -> work.kind().equals(kind)).map(TypedWork::work).toList();
                return new CommunityPage(matching.stream().skip((long) (page - 1) * size).limit(size).toList(),
                    matching.size(), page, size, components, all.size() - components);
            }).timeout(Duration.ofSeconds(30))
            .onErrorMap(error -> !(error instanceof ResponseStatusException),
                error -> unavailable("市场分类读取超时或失败，请刷新重试"));
    }

    private Mono<String> kind(CommunityWork work) {
        // A published revision changes this key; cache only the type, never package content or credentials.
        String key = work.name() + ":" + work.version() + ":" + work.publishedAt();
        synchronized (kinds) {
            String known = kinds.get(key);
            if (known != null) return Mono.just(known);
        }
        return market.get(work.name()).map(detail -> {
            try {
                var value = mapper.readTree(detail.packageJson());
                if (value == null || !value.isObject()) throw unavailable("市场作品包格式无效");
                String type = value.path("kind").asText("component");
                if (!type.equals("component") && !type.equals("theme")) throw unavailable("市场作品类型无效");
                synchronized (kinds) {
                    kinds.put(key, type);
                    if (kinds.size() > 512) kinds.remove(kinds.keySet().iterator().next());
                }
                return type;
            } catch (ResponseStatusException error) { throw error; }
            catch (Exception error) { throw unavailable("无法读取市场作品类型，请刷新重试"); }
        });
    }

    private static ResponseStatusException unavailable(String message) {
        return new ResponseStatusException(HttpStatus.BAD_GATEWAY, message);
    }
    private record TypedWork(CommunityWork work, String kind) {}
}
