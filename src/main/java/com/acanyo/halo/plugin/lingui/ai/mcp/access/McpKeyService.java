package com.acanyo.halo.plugin.lingui.ai.mcp.access;

import static com.acanyo.halo.plugin.lingui.ai.mcp.access.McpKeyDtos.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Secret;

/** Dedicated capability keys: only a SHA-256 digest is persisted, never a Halo PAT. */
@Service
public class McpKeyService {
    private static final String LABEL = "lingui.acanyo.com/mcp-owner";
    private static final String MANAGED = "lingui.acanyo.com/managed-by";
    private static final SecureRandom RANDOM = new SecureRandom();
    private final ReactiveExtensionClient client;
    private final McpOwnerPermissions permissions;
    public McpKeyService(ReactiveExtensionClient client, McpOwnerPermissions permissions) {
        this.client = client; this.permissions = permissions;
    }
    public Mono<McpKeyList> list(String owner) {
        return secrets(owner).map(this::info).sort(java.util.Comparator.comparing(McpKeyInfo::createdAt).reversed())
            .collectList().map(McpKeyList::new);
    }
    public Mono<IssuedMcpKey> create(String owner, CreateMcpKeyRequest input) {
        return Mono.defer(() -> {
            if (input.name() == null || input.name().isBlank() || input.name().length() > 80
                || input.expiresInDays() == null || input.expiresInDays() < 1 || input.expiresInDays() > 365)
                throw bad("请输入密钥名称及 1–365 天有效期");
            List<String> works = input.workNames() == null ? List.of() : input.workNames();
            boolean allWorks = Boolean.TRUE.equals(input.allWorks());
            if (allWorks && !works.isEmpty())
                throw bad("全部项目与指定项目不能同时授权，请选择一种范围");
            if (works.size() > 50 || works.stream().anyMatch(name -> name == null || !name.matches("[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}")))
                throw bad("项目授权最多 50 项，且必须使用有效的资源名称");
            var allowed = works.stream().distinct().toList();
            return permissions.requireMcp(owner).thenMany(Flux.fromIterable(allowed)
                .concatMap(work -> permissions.requireWork(owner, work))).then(secrets(owner).count())
                .flatMap(count -> {
                    if (count >= 50) return Mono.error(bad("每个账号最多保留 50 个接入密钥，请删除已停用的密钥后再创建"));
                    String id = UUID.randomUUID().toString().replace("-", "");
                    byte[] random = new byte[32]; RANDOM.nextBytes(random);
                    String token = "lgu_mcp_" + id + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(random);
                    var values = new LinkedHashMap<String, String>();
                    values.put("owner", owner); values.put("name", input.name().trim()); values.put("hash", hash(token));
                    values.put("prefix", token.substring(0, 16)); values.put("createdAt", Instant.now().toString());
                    values.put("expiresAt", Instant.now().plus(input.expiresInDays(), ChronoUnit.DAYS).toString());
                    values.put("works", String.join("\n", allowed));
                    values.put("allWorks", Boolean.toString(allWorks));
                    values.put("submitDrafts", Boolean.toString(Boolean.TRUE.equals(input.submitDrafts())));
                    var secret = new Secret(); secret.setMetadata(new Metadata());
                    secret.getMetadata().setName("lingui-mcp-" + id);
                    secret.getMetadata().setLabels(Map.of(LABEL, hash(owner), MANAGED, "mcp-key"));
                    secret.setType(Secret.SECRET_TYPE_OPAQUE); secret.setStringData(values);
                    return client.create(secret).map(saved -> new IssuedMcpKey(info(saved), token));
                });
        });
    }
    public Mono<Void> revoke(String owner, String id) {
        return owned(owner, id).flatMap(secret -> {
            var data = values(secret); data.remove("hash"); data.put("revokedAt", Instant.now().toString());
            secret.setData(null); secret.setStringData(data);
            return client.update(secret);
        }).then();
    }
    public Mono<Void> delete(String owner, String id) {
        return owned(owner, id).flatMap(secret -> {
            if (value(secret, "revokedAt").isEmpty() && Instant.parse(value(secret, "expiresAt")).isAfter(Instant.now()))
                return Mono.error(bad("请先撤销密钥，再删除记录"));
            return client.delete(secret);
        }).then();
    }
    public Mono<Grant> authenticate(String token) {
        return Mono.defer(() -> {
            if (token == null || !token.matches("lgu_mcp_[a-f0-9]{32}\\.[A-Za-z0-9_-]{43}"))
                return Mono.error(unauthorized());
            String id = token.substring(8, 40);
            return client.fetch(Secret.class, "lingui-mcp-" + id).filter(this::active)
                .filter(secret -> MessageDigest.isEqual(hash(token).getBytes(StandardCharsets.US_ASCII), value(secret, "hash").getBytes(StandardCharsets.US_ASCII)))
                .switchIfEmpty(Mono.error(unauthorized()))
                .flatMap(secret -> permissions.requireMcp(value(secret, "owner"))
                    .then(touch(secret)).thenReturn(new Grant(value(secret, "owner"), info(secret).workNames(), info(secret).allWorks(),
                        info(secret).submitDrafts(), id, value(secret, "name"))));
        });
    }
    public record Grant(String owner, List<String> workNames, boolean allWorks, boolean submitDrafts, String keyId, String keyName) {
        public Grant(String owner, List<String> workNames, boolean allWorks) {
            this(owner, workNames, allWorks, false, "", "");
        }
        public boolean allows(String workName) { return allWorks || workNames.contains(workName); }
        public boolean canReadWorks() { return allWorks || !workNames.isEmpty(); }
    }
    private boolean active(Secret secret) {
        try { return secret.getMetadata().getDeletionTimestamp() == null && "mcp-key".equals(secret.getMetadata().getLabels().get(MANAGED))
            && value(secret, "revokedAt").isEmpty() && !value(secret, "hash").isEmpty()
            && Instant.parse(value(secret, "expiresAt")).isAfter(Instant.now()); }
        catch (RuntimeException invalid) { return false; }
    }
    private Mono<Void> touch(Secret secret) {
        String last = value(secret, "lastUsedAt");
        if (!last.isEmpty() && Instant.parse(last).plusSeconds(60).isAfter(Instant.now())) return Mono.empty();
        var data = values(secret); data.put("lastUsedAt", Instant.now().toString());
        secret.setData(null); secret.setStringData(data);
        // Optimistic version conflicts can occur with parallel tools or revocation. Never retry a stale write.
        return client.update(secret).then().onErrorResume(error -> Mono.empty());
    }
    private Mono<Secret> owned(String owner, String id) {
        if (!id.matches("[a-f0-9]{32}")) return Mono.error(bad("密钥标识无效"));
        return client.fetch(Secret.class, "lingui-mcp-" + id)
            .filter(secret -> secret.getMetadata().getDeletionTimestamp() == null && owner.equals(value(secret, "owner")))
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.NOT_FOUND, "密钥不存在")));
    }
    private Flux<Secret> secrets(String owner) {
        var options = ListOptions.builder().labelSelector().eq(LABEL, hash(owner)).eq(MANAGED, "mcp-key").end().build();
        return client.listAll(Secret.class, options, Sort.unsorted())
            .filter(secret -> secret.getMetadata().getDeletionTimestamp() == null && owner.equals(value(secret, "owner")));
    }
    private McpKeyInfo info(Secret secret) {
        return new McpKeyInfo(secret.getMetadata().getName().substring("lingui-mcp-".length()), value(secret, "name"),
            value(secret, "prefix"), value(secret, "createdAt"), value(secret, "expiresAt"), value(secret, "lastUsedAt"),
            !value(secret, "revokedAt").isEmpty(), value(secret, "works").isEmpty() ? List.of() : List.of(value(secret, "works").split("\n")),
            "true".equals(value(secret, "allWorks")), "true".equals(value(secret, "submitDrafts")));
    }
    private static Map<String, String> values(Secret secret) {
        var result = new LinkedHashMap<String, String>();
        if (secret.getData() != null) secret.getData().forEach((key, bytes) -> result.put(key, new String(bytes, StandardCharsets.UTF_8)));
        if (secret.getStringData() != null) result.putAll(secret.getStringData());
        return result;
    }
    private static String value(Secret secret, String key) { return values(secret).getOrDefault(key, ""); }
    private static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private static ResponseStatusException bad(String text) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, text); }
    private static ResponseStatusException unauthorized() { return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "MCP 接入密钥无效、已过期或已撤销"); }
}
