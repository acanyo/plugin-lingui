package com.acanyo.halo.plugin.lingui.market;

import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.extension.Metadata;
import run.halo.app.extension.ReactiveExtensionClient;
import run.halo.app.extension.Secret;

/** One credential per authenticated local user; secrets are never returned to the browser. */
@Service
public class MarketCredentials {
    private final ReactiveExtensionClient client;
    private final MarketClient market;
    public MarketCredentials(ReactiveExtensionClient client, MarketClient market) { this.client = client; this.market = market; }
    static String name(String actor) {
        try {
            return "lingui-market-" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(actor.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
    }
    private Mono<Secret> fetch(String actor) { return client.fetch(Secret.class, name(actor)).filter(s -> s.getMetadata().getDeletionTimestamp() == null); }
    static String value(Secret secret, String key) {
        if (secret.getStringData() != null && secret.getStringData().containsKey(key)) return secret.getStringData().get(key);
        var bytes = secret.getData() == null ? null : secret.getData().get(key);
        return bytes == null ? "" : new String(bytes, StandardCharsets.UTF_8);
    }
    private static MarketConnection status(Secret secret) {
        return new MarketConnection(true, value(secret, "username"), value(secret, "displayName"), MarketClient.SITE);
    }
    public Mono<MarketConnection> status(String actor) {
        return fetch(actor).filter(s -> !value(s, "token").isBlank()).map(MarketCredentials::status)
            .defaultIfEmpty(new MarketConnection(false, "", "", MarketClient.SITE));
    }
    public Mono<String> token(String actor) {
        return fetch(actor).map(s -> value(s, "token")).filter(t -> !t.isBlank())
            .switchIfEmpty(Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "请先连接市场账号")));
    }
    public Mono<MarketConnection> connect(String actor, MarketConnectRequest input) {
        var token = input.token() == null ? "" : input.token().trim();
        if (token.isBlank() || token.length() > 4096 || !token.matches("[!-~]+"))
            return Mono.error(new ResponseStatusException(HttpStatus.BAD_REQUEST, "请输入有效的市场个人访问令牌"));
        return market.user(token).flatMap(user -> {
            if (user.name() == null || user.name().isBlank()) return Mono.error(new ResponseStatusException(HttpStatus.BAD_GATEWAY, "市场未返回有效的账号身份"));
            return market.mine(token, 1, 1).then(fetch(actor).flatMap(existing -> {
                existing.setData(null);
                existing.setStringData(values(token, user));
                return client.update(existing);
            }).switchIfEmpty(Mono.defer(() -> {
                var secret = new Secret();
                secret.setMetadata(new Metadata()); secret.getMetadata().setName(name(actor));
                secret.getMetadata().setLabels(Map.of("lingui.acanyo.com/managed-by", "market-connection"));
                secret.setType(Secret.SECRET_TYPE_OPAQUE); secret.setStringData(values(token, user));
                return client.create(secret);
            }))).map(MarketCredentials::status);
        });
    }
    private static Map<String, String> values(String token, MarketUser user) {
        return Map.of("token", token, "username", user.name(), "displayName", user.displayName() == null ? user.name() : user.displayName());
    }
    public Mono<Void> disconnect(String actor) { return fetch(actor).flatMap(client::delete).then(); }
}
