package com.acanyo.halo.plugin.lingui.market;

import static com.acanyo.halo.plugin.lingui.market.MarketDtos.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;

class MarketCatalogTest {
    private CommunityWork work(String name, String category, String version) {
        return new CommunityWork(name, name, "说明", category, "作者", version, "MIT", "2026-10-15");
    }

    @Test
    void groupsByActualPackageKindBeforePaginationAndIncludesBothCounts() {
        var market = mock(MarketClient.class);
        var theme = work("work-theme", "阅读", "1.0.0");
        var first = work("work-first", "主题", "1.0.0");
        var last = work("work-last", "学习", "1.0.0");
        when(market.list(1, 50, "学习")).thenReturn(Mono.just(new CommunityPage(List.of(theme, first), 3, 1, 2)));
        when(market.list(2, 50, "学习")).thenReturn(Mono.just(new CommunityPage(List.of(last), 3, 2, 2)));
        when(market.get(theme.name())).thenReturn(Mono.just(new CommunityDetail(theme, "{\"kind\":\"theme\"}")));
        when(market.get(first.name())).thenReturn(Mono.just(new CommunityDetail(first, "{}")));
        when(market.get(last.name())).thenReturn(Mono.just(new CommunityDetail(last, "{\"kind\":\"component\"}")));
        var catalog = new MarketCatalog(market);
        var components = catalog.list(2, 1, "学习", "component").block();
        assertEquals(List.of(last), components.items());
        assertEquals(2, components.total());
        assertEquals(2L, components.componentTotal());
        assertEquals(1L, components.themeTotal());
        var themes = catalog.list(1, 9, "学习", "theme").block();
        assertEquals(List.of(theme), themes.items());
        assertEquals(1, themes.total());
        verify(market, times(1)).get(theme.name());
        verify(market, times(1)).get(first.name());
    }

    @Test
    void invalidatesTypeCacheWhenThePublishedRevisionChanges() {
        var market = mock(MarketClient.class);
        var old = work("work-existing", "主题", "1.0.0");
        var updated = work(old.name(), "主题", "1.1.0");
        when(market.list(1, 50, "")).thenReturn(Mono.just(new CommunityPage(List.of(old), 1, 1, 50)),
            Mono.just(new CommunityPage(List.of(updated), 1, 1, 50)));
        when(market.get(old.name())).thenReturn(Mono.just(new CommunityDetail(old, "{\"kind\":\"theme\"}")),
            Mono.just(new CommunityDetail(updated, "{\"kind\":\"theme\"}")));
        var catalog = new MarketCatalog(market);
        catalog.list(1, 9, "", "theme").block();
        assertEquals("1.1.0", catalog.list(1, 9, "", "theme").block().items().getFirst().version());
        verify(market, times(2)).get(old.name());
    }

    @Test
    void preservesTheUnfilteredApiWithoutExtraPackageRequests() {
        var market = mock(MarketClient.class);
        when(market.list(3, 9, "test")).thenReturn(Mono.just(new CommunityPage(List.of(), 0, 3, 9)));
        assertEquals(0, new MarketCatalog(market).list(3, 9, "test", "").block().total());
        verify(market).list(3, 9, "test");
        verifyNoMoreInteractions(market);
    }
}
