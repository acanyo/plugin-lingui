package com.acanyo.halo.plugin.lingui.ai.tools;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;
import org.springframework.web.reactive.function.server.RouterFunction;
import org.springframework.web.reactive.function.server.RouterFunctions;
import org.springframework.web.reactive.function.server.ServerResponse;

class PublicApiCatalogTest {
    @Test
    @SuppressWarnings("unchecked")
    void discoversPublicRouterMetadataAndExcludesConsoleRoutes() {
        ApplicationContext context = mock(ApplicationContext.class);
        RouterFunction<ServerResponse> publicRoute = RouterFunctions.route()
            .GET("/apis/api.example.test/v1alpha1/posts",
                request -> ServerResponse.ok().build())
            .build();
        RouterFunction<ServerResponse> consoleRoute = RouterFunctions.route()
            .GET("/apis/api.console.example.test/v1alpha1/posts",
                request -> ServerResponse.ok().build())
            .build();
        RouterFunction<ServerResponse> writeRoute = RouterFunctions.route()
            .POST("/apis/api.example.test/v1alpha1/posts",
                request -> ServerResponse.ok().build())
            .build();
        when(context.getBeansOfType(RouterFunction.class)).thenReturn(Map.of(
            "publicRoute", publicRoute, "consoleRoute", consoleRoute, "writeRoute", writeRoute));

        var result = new PublicApiCatalog(context).search("posts", 20);
        var items = (List<Map<String, Object>>) result.get("items");

        assertThat(items).extracting(item -> item.get("path"))
            .containsExactly("/apis/api.example.test/v1alpha1/posts");
        assertThat(PublicApiCatalog.isPublicPath("/apis/api.example.test/v1alpha1/posts")).isTrue();
        assertThat(PublicApiCatalog.isPublicPath("/apis/api.console.example.test/v1alpha1/posts")).isFalse();
        assertThat(PublicApiCatalog.isPublicPath("/apis/api.notification.halo.run/v1alpha1/userspaces/x"))
            .isFalse();
        assertThat(PublicApiCatalog.isReadOnlyMethod(
            org.springframework.web.bind.annotation.RequestMethod.GET)).isTrue();
        assertThat(PublicApiCatalog.isReadOnlyMethod(
            org.springframework.web.bind.annotation.RequestMethod.POST)).isFalse();
    }

    @Test
    void returnsBoundedReferenceToolContracts() {
        var definitions = ApiReferenceTools.definitions();

        assertThat(definitions).extracting(CreationTools.Definition::name)
            .containsExactly("search_public_apis", "get_public_api");
        assertThat(definitions.getFirst().inputSchema()).containsEntry("additionalProperties", false);
        assertThat(definitions.get(1).inputSchema()).containsEntry("additionalProperties", false);
        assertThat(SiteReferenceTools.definitions()).extracting(CreationTools.Definition::name)
            .containsExactly("get_site_profile", "get_navigation");
        assertThat(ContentReferenceTools.definitions()).extracting(CreationTools.Definition::name)
            .containsExactly("list_posts", "list_single_pages", "read_content", "search_attachments");
    }

    @Test
    void addsApiToolsToTheRuntimeCreationSession() throws Exception {
        var tools = new CreationTools(new ComponentCatalog(), mock(PublicApiCatalog.class),
            mock(SiteReferenceTools.class), mock(ContentReferenceTools.class), new SkillResources(),
            new com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator());

        assertThat(tools.definitions()).extracting(CreationTools.Definition::name)
            .contains("search_public_apis", "get_public_api", "get_site_profile", "get_navigation",
                "list_posts", "list_single_pages", "read_content", "search_attachments",
                "suggest_api_bindings");
    }
}
