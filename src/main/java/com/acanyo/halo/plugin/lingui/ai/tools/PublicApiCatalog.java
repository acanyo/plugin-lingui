package com.acanyo.halo.plugin.lingui.ai.tools;

import static org.springdoc.core.utils.Constants.OPERATION_ATTRIBUTE;

import io.swagger.v3.oas.annotations.Operation;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Predicate;
import org.springdoc.core.fn.RouterFunctionData;
import org.springdoc.core.fn.builders.operation.Builder;
import org.springdoc.webflux.core.visitor.RouterFunctionVisitor;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.bind.annotation.RequestMethod;

/**
 * Discovers the current Halo instance's public router metadata without executing any
 * request. The AI receives route contracts, not credentials or data snapshots.
 */
@Component
public class PublicApiCatalog {
    private static final long TTL_NANOS = Duration.ofSeconds(60).toNanos();
    private static final int MAX_SEARCH_BYTES = 16 * 1024;
    private static final int MAX_DETAIL_BYTES = 64 * 1024;
    private static final Predicate<String> PUBLIC_PATH = PublicApiCatalog::isPublicPath;

    private final ApplicationContext applicationContext;
    private final Object lock = new Object();
    private volatile Snapshot snapshot;

    public PublicApiCatalog(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    public Map<String, Object> search(String query, int limit) {
        if (query == null || query.length() > 200) {
            throw new IllegalArgumentException("查询关键词不能超过 200 个字符");
        }
        if (limit < 1 || limit > 20) {
            throw new IllegalArgumentException("limit 必须为 1–20 的整数");
        }
        var current = current();
        var terms = words(query);
        var ranked = current.items().stream()
            .map(item -> new Match(item, score(item, query, terms)))
            .filter(match -> terms.isEmpty() || match.score() > 0)
            .sorted(Comparator.comparingInt(Match::score).reversed()
                .thenComparing(match -> String.valueOf(match.item().get("id"))))
            .toList();
        var matches = ranked.stream().limit(limit)
            .map(Match::item).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
        var result = new LinkedHashMap<String, Object>();
        result.put("items", matches);
        result.put("totalMatches", ranked.size());
        result.put("truncated", ranked.size() > limit);
        result.put("partial", current.partial());
        result.put("warnings", current.warnings());
        result.put("anonymousAccess", "unverified");
        trimItems(result, MAX_SEARCH_BYTES);
        return result;
    }

    public Map<String, Object> details(List<String> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > 3
            || ids.stream().anyMatch(id -> id == null || id.isBlank() || id.length() > 2048)) {
            throw new IllegalArgumentException("ids 必须包含 1–3 个接口 ID，每个不超过 2048 字符");
        }
        var current = current();
        var items = new ArrayList<Map<String, Object>>();
        for (String id : ids.stream().distinct().toList()) {
            var routes = current.routes().get(id);
            if (routes == null) {
                items.add(failure(id, "not_found", "当前路由中未找到该公开接口"));
            } else if (routes.size() > 1) {
                items.add(failure(id, "ambiguous", "同一路径和方法存在多个接口契约"));
            } else {
                items.add(detail(routes.getFirst()));
            }
        }
        var result = new LinkedHashMap<String, Object>();
        result.put("items", items);
        result.put("partial", current.partial() || items.stream()
            .anyMatch(item -> !"ok".equals(item.get("status")) || Boolean.TRUE.equals(item.get("partial"))));
        result.put("warnings", current.warnings());
        result.put("anonymousAccess", "unverified");
        trimItems(result, MAX_DETAIL_BYTES);
        return result;
    }

    /**
     * Returns the same bounded contract used by {@link #details(List)} for one exact
     * method/path pair. This is deliberately read-only: callers use it to verify an
     * event binding, never to execute a request.
     */
    public Map<String, Object> contract(String method, String path) {
        if (method == null || path == null || method.isBlank() || path.isBlank()) {
            return failure(String.valueOf(method) + " " + path, "not_found", "接口方法或路径为空");
        }
        String normalizedMethod = method.trim().toUpperCase(Locale.ROOT);
        String id = normalizedMethod + " " + path;
        var routes = current().routes().get(id);
        if (routes == null || routes.isEmpty()) return failure(id, "not_found", "当前路由中未找到该公开接口");
        if (routes.size() > 1) return failure(id, "ambiguous", "同一路径和方法存在多个接口契约");
        return detail(routes.getFirst());
    }

    public static boolean isPublicPath(String path) {
        if (path == null || !path.startsWith("/apis/api.")) return false;
        return !path.startsWith("/apis/api.console.")
            && !path.startsWith("/apis/api.notification.halo.run/");
    }

    static boolean isReadOnlyMethod(RequestMethod method) {
        return method == RequestMethod.GET || method == RequestMethod.HEAD
            || method == RequestMethod.OPTIONS;
    }

    private Snapshot current() {
        var current = snapshot;
        if (current != null && System.nanoTime() - current.createdAt() < TTL_NANOS) return current;
        synchronized (lock) {
            current = snapshot;
            if (current == null || System.nanoTime() - current.createdAt() >= TTL_NANOS) {
                current = scan();
                snapshot = current;
            }
            return current;
        }
    }

    private Snapshot scan() {
        var routes = new TreeMap<String, List<Route>>();
        var warnings = new ArrayList<String>();
        boolean partial = false;
        for (var entry : rootContext().getBeansOfType(RouterFunction.class).entrySet()) {
            var visitor = new RouterFunctionVisitor();
            try {
                entry.getValue().accept(visitor);
            } catch (RuntimeException | LinkageError error) {
                partial = true;
                addWarning(warnings, "部分路由无法遍历：" + bounded(entry.getKey(), 120));
                continue;
            }
            for (RouterFunctionData data : visitor.getRouterFunctionDatas()) {
                if (!PUBLIC_PATH.test(data.getPath()) || data.getMethods() == null) continue;
                Operation operation = operation(data, warnings);
                var attribute = data.getAttributes().get(OPERATION_ATTRIBUTE);
                for (RequestMethod method : data.getMethods()) {
                    if (!isReadOnlyMethod(method)) continue;
                    var id = method.name() + " " + data.getPath();
                    var candidates = routes.computeIfAbsent(id, ignored -> new ArrayList<>());
                    var duplicate = attribute != null
                        && candidates.stream().anyMatch(route -> route.attribute() == attribute);
                    if (!duplicate) {
                        candidates.add(new Route(id, method.name(), data.getPath(), operation,
                            conditions(data), attribute));
                    }
                }
            }
        }
        var items = routes.values().stream().flatMap(List::stream)
            .map(PublicApiCatalog::summary).toList();
        return new Snapshot(System.nanoTime(), items, routes, partial, List.copyOf(warnings));
    }

    private Operation operation(RouterFunctionData data, List<String> warnings) {
        var attribute = data.getAttributes().get(OPERATION_ATTRIBUTE);
        if (!(attribute instanceof Builder builder)) return null;
        try {
            return builder.build().getOperation();
        } catch (RuntimeException | LinkageError error) {
            addWarning(warnings, "接口元数据无法读取：" + bounded(data.getPath(), 180));
            return null;
        }
    }

    private ApplicationContext rootContext() {
        var root = applicationContext;
        while (root.getParent() != null) root = root.getParent();
        return root;
    }

    private static Map<String, Object> summary(Route route) {
        var result = new LinkedHashMap<String, Object>();
        result.put("id", route.id());
        result.put("method", route.method());
        result.put("path", route.path());
        var operation = route.operation();
        if (operation != null) {
            text(result, "operationId", operation.operationId());
            text(result, "summary", operation.summary());
            text(result, "description", operation.description());
            result.put("tags", Arrays.stream(operation.tags()).limit(12)
                .map(value -> bounded(value, 120)).toList());
            if (operation.deprecated()) result.put("deprecated", true);
            result.put("contract", "declared");
        } else {
            result.put("contract", "unavailable");
        }
        if (!route.conditions().isEmpty()) result.put("routeConditions", route.conditions());
        return result;
    }

    private static Map<String, Object> detail(Route route) {
        if (route.operation() == null) return failure(route.id(), "unavailable", "接口未声明可读取的契约");
        try {
            var detail = new LinkedHashMap<>(summary(route));
            detail.putAll(new PublicApiSchemaResolver().resolve(route.operation()));
            detail.put("status", "ok");
            detail.put("anonymousAccess", "unverified");
            return detail;
        } catch (RuntimeException | LinkageError error) {
            return failure(route.id(), "unavailable", "接口契约无法完整解析："
                + bounded(error.getMessage(), 200));
        }
    }

    private static Map<String, Object> conditions(RouterFunctionData data) {
        var result = new LinkedHashMap<String, Object>();
        if (data.getQueryParams() != null && !data.getQueryParams().isEmpty())
            result.put("queryParams", Map.copyOf(data.getQueryParams()));
        if (data.getHeaders() != null && data.getHeaders().length > 0)
            result.put("headers", List.of(data.getHeaders()));
        if (data.getParams() != null && data.getParams().length > 0)
            result.put("params", List.of(data.getParams()));
        if (data.getConsumes() != null && data.getConsumes().length > 0)
            result.put("consumes", List.of(data.getConsumes()));
        if (data.getProduces() != null && data.getProduces().length > 0)
            result.put("produces", List.of(data.getProduces()));
        return Map.copyOf(result);
    }

    private static int score(Map<String, Object> item, String query, List<String> terms) {
        if (terms.isEmpty()) return 0;
        int score = 0;
        for (var field : List.of("operationId", "path", "tags", "summary", "description")) {
            var text = String.valueOf(item.getOrDefault(field, ""));
            if (text.equalsIgnoreCase(query.trim())) score += 100;
            var tokens = words(text);
            for (var term : terms) {
                if (tokens.contains(term)) score += field.equals("description") ? 1 : 4;
                else if (text.toLowerCase(Locale.ROOT).contains(term)) score++;
            }
        }
        return score;
    }

    private static List<String> words(String value) {
        return Arrays.stream(value.replaceAll("([a-z0-9])([A-Z])", "$1 $2")
                .toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}]+"))
            .filter(word -> !word.isBlank()).distinct().toList();
    }

    private static Map<String, Object> failure(String id, String status, String message) {
        return Map.of("id", id, "status", status, "error", message);
    }

    @SuppressWarnings("unchecked")
    private static void trimItems(Map<String, Object> result, int maxBytes) {
        var items = (List<Map<String, Object>>) result.get("items");
        while (bytes(result) > maxBytes && !items.isEmpty()) {
            items.removeLast();
            result.put("truncated", true);
        }
    }

    private static int bytes(Map<String, Object> result) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(result)
                .getBytes(StandardCharsets.UTF_8).length;
        } catch (Exception error) {
            return Integer.MAX_VALUE;
        }
    }

    private static void text(Map<String, Object> result, String key, String value) {
        if (value != null && !value.isBlank()) result.put(key, bounded(value, 1200));
    }

    private static String bounded(String value, int max) {
        if (value == null) return "";
        return value.substring(0, Math.min(value.length(), max));
    }

    private static void addWarning(List<String> warnings, String message) {
        if (warnings.size() < 10) warnings.add(message);
    }

    private record Route(String id, String method, String path, Operation operation,
                         Map<String, Object> conditions, Object attribute) { }

    private record Snapshot(long createdAt, List<Map<String, Object>> items,
                            Map<String, List<Route>> routes, boolean partial,
                            List<String> warnings) { }

    private record Match(Map<String, Object> item, int score) { }
}
