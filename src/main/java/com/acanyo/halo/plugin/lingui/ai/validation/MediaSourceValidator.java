package com.acanyo.halo.plugin.lingui.ai.validation;
import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.Set;
/** Validates passive resource addresses; never retrieves media on the server. */
final class MediaSourceValidator {
    private MediaSourceValidator() {}
    static void validate(JsonNode node) {
        if (Set.of("Image", "Video", "AudioPlayer", "LingUI.Avatar").contains(node.path("component").asText()) && node.path("url").isTextual()) validateUrl(node.path("url").asText());
        for (var member : node.path("members")) if (member.has("url")) validateUrl(member.path("url").asText());
    }
    static void validateUrl(String value) {
        if (value.isEmpty()) return;
        if (value.length() > 2048 || value.chars().anyMatch(c -> Character.isWhitespace(c) || c < 32 || c == 127 || c == '\\')) {
            throw bad("媒体资源地址无效");
        }
        if (value.startsWith("/") && !value.startsWith("//")) return;
        try {
            var uri = URI.create(value);
            String host = uri.getHost();
            boolean local = host != null && Set.of("localhost", "127.0.0.1", "[::1]").contains(host.toLowerCase());
            if (host == null || uri.getRawUserInfo() != null || !("https".equalsIgnoreCase(uri.getScheme()) || ("http".equalsIgnoreCase(uri.getScheme()) && local))) {
                throw bad("媒体只允许 HTTPS 或站内资源地址");
            }
        } catch (IllegalArgumentException exception) {
            throw bad("媒体资源地址无效");
        }
    }

}
