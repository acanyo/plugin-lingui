package com.acanyo.halo.plugin.lingui.market;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

public final class MarketDtos {
    private MarketDtos() {}
    public record MarketConnection(boolean connected, String username, String displayName, String siteUrl) {}
    public record MarketConnectRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 4096) String token) {}
    public record MarketSubmitRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED, maxLength = 524288) String packageJson,
                                      Long expectedVersion) {}
    public record MarketVersionRequest(@Schema(requiredMode = Schema.RequiredMode.REQUIRED) Long expectedVersion) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CommunityWork(String name, String title, String description, String category, String author,
                                String version, String license, String publishedAt) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CommunityPage(List<CommunityWork> items, long total, int page, int size,
                                Long componentTotal, Long themeTotal) {
        public CommunityPage(List<CommunityWork> items, long total, int page, int size) {
            this(items, total, page, size, null, null);
        }
    }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CommunityDetail(CommunityWork work, String packageJson) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MyMarketWork(String name, String title, String description, String category, String author,
                               String version, String status, String publishedVersion, String updatedAt, Long resourceVersion) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MyMarketPage(List<MyMarketWork> items, long total, int page, int size) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MarketRevision(String id, String version, String packageJson, String title, String status,
                                 String submittedAt, String reviewNote, String reviewedAt) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MyMarketDetail(String name, Long resourceVersion, String publishedRevision, boolean archived,
                                 List<MarketRevision> revisions) {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record MarketUser(String name, String displayName) {}
}
