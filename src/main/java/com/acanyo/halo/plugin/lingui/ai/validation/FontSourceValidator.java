package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.regex.Pattern;

/** Validates font manifests without requesting any external font or stylesheet. */
final class FontSourceValidator {
    private static final Pattern RANGE = Pattern.compile("^U\\+([0-9A-F]{1,6})(?:-([0-9A-F]{1,6}))?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern WILDCARD = Pattern.compile("^U\\+([0-9A-F]*\\?+)$", Pattern.CASE_INSENSITIVE);

    private FontSourceValidator() {}

    static void validate(JsonNode font) {
        if (font.isMissingNode()) return;
        if (font.path("name").asText().isBlank() || font.toString().getBytes(StandardCharsets.UTF_8).length > 196608) {
            throw bad("字体名称不能为空，配置不能超过 192 KiB");
        }
        for (var face : font.path("faces")) {
            validateUrl(face.path("url").asText());
            var weights = face.path("weight").asText().split("\\s+");
            int from = Integer.parseInt(weights[0]);
            int to = Integer.parseInt(weights[weights.length - 1]);
            if (from < 1 || to > 1000 || from > to) throw bad("字体字重范围无效");
            if (face.has("unicodeRange")) validateRange(face.path("unicodeRange").asText());
        }
    }

    private static void validateUrl(String value) {
        if (value.chars().anyMatch(c -> Character.isWhitespace(c) || c < 32 || c == 127 || c == '\\')) throw bad("字体资源地址无效");
        try {
            var uri = URI.create(value);
            var host = uri.getHost();
            boolean local = host != null && Set.of("localhost", "127.0.0.1", "[::1]").contains(host.toLowerCase());
            if (host == null || uri.getRawUserInfo() != null || uri.getRawFragment() != null
                || !("https".equalsIgnoreCase(uri.getScheme()) || ("http".equalsIgnoreCase(uri.getScheme()) && local))) {
                throw bad("字体需要绝对 HTTPS 地址；本地开发可使用 HTTP");
            }
        } catch (IllegalArgumentException exception) {
            throw bad("字体资源地址无效");
        }
    }

    private static void validateRange(String value) {
        var ranges = value.split(",", -1);
        if (ranges.length > 128) throw bad("字体字符范围过多");
        for (var part : ranges) {
            var range = RANGE.matcher(part.trim());
            if (range.matches()) {
                int start = Integer.parseInt(range.group(1), 16);
                int end = Integer.parseInt(range.group(2) == null ? range.group(1) : range.group(2), 16);
                if (start <= end && end <= 0x10ffff) continue;
            } else {
                var wildcard = WILDCARD.matcher(part.trim());
                if (wildcard.matches() && wildcard.group(1).length() <= 6
                    && Integer.parseInt(wildcard.group(1).replace('?', 'F'), 16) <= 0x10ffff) continue;
            }
            throw bad("字体字符范围无效");
        }
    }
}
