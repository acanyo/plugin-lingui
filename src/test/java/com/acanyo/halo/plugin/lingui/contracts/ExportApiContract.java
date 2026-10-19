package com.acanyo.halo.plugin.lingui.contracts;

import com.acanyo.halo.plugin.lingui.ai.AiEndpoint;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import com.acanyo.halo.plugin.lingui.model.DesignTheme;
import com.acanyo.halo.plugin.lingui.model.FontFamily;
import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.Operation;
import io.swagger.v3.oas.models.PathItem;
import io.swagger.v3.oas.models.Paths;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.media.Content;
import io.swagger.v3.oas.models.media.MediaType;
import io.swagger.v3.oas.models.media.Schema;
import io.swagger.v3.oas.models.media.IntegerSchema;
import io.swagger.v3.oas.models.media.StringSchema;
import io.swagger.v3.oas.models.parameters.Parameter;
import io.swagger.v3.oas.models.parameters.RequestBody;
import io.swagger.v3.oas.models.responses.ApiResponse;
import io.swagger.v3.oas.models.responses.ApiResponses;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import run.halo.app.extension.GVK;
import run.halo.app.extension.ListResult;

/** Offline bootstrap from actual Java models; regenerate from live Halo OpenAPI before releases. */
public final class ExportApiContract {
    private static final Components COMPONENTS = new Components();
    private static Schema<?> model(Class<?> type) {
        var schemas = ModelConverters.getInstance().readAll(type);
        schemas.forEach(COMPONENTS::addSchemas);
        String name = schemas.keySet().stream().filter(key -> key.equals(type.getSimpleName())).findFirst()
            .orElseGet(() -> schemas.keySet().stream().filter(key -> key.endsWith("List")).findFirst().orElseThrow());
        return new Schema<>().$ref("#/components/schemas/" + name);
    }
    private static Content content(Schema<?> schema) { return new Content().addMediaType("application/json", new MediaType().schema(schema)); }
    private static Operation operation(String id, String tag, Schema<?> response) {
        return new Operation().operationId(id).tags(List.of(tag)).responses(new ApiResponses()
            .addApiResponse("200", new ApiResponse().description("成功").content(content(response))));
    }
    public static void main(String[] args) throws Exception {
        var paths = new Paths();
        for (var type : List.of(ComponentTemplate.class, DesignTheme.class, FontFamily.class)) {
            var gvk = type.getAnnotation(GVK.class);
            var name = type.getSimpleName();
            var tag = name + "V1alpha1";
            var resource = model(type);
            var listSchema = model(ListResult.generateGenericClass(type));
            var base = "/apis/" + gvk.group() + "/" + gvk.version() + "/" + gvk.plural();
            var list = operation("list" + name, tag, listSchema)
                .addParametersItem(new Parameter().name("page").in("query").schema(new IntegerSchema()))
                .addParametersItem(new Parameter().name("size").in("query").schema(new IntegerSchema()));
            paths.addPathItem(base, new PathItem().get(list).post(operation("create" + name, tag, resource)
                .requestBody(new RequestBody().required(true).content(content(resource)))));
            var pathParameter = new Parameter().name("name").in("path").required(true).schema(new StringSchema());
            paths.addPathItem(base + "/{name}", new PathItem()
                .get(operation("get" + name, tag, resource).addParametersItem(pathParameter))
                .put(operation("update" + name, tag, resource).addParametersItem(pathParameter)
                    .requestBody(new RequestBody().required(true).content(content(resource))))
                .delete(operation("delete" + name, tag, resource).addParametersItem(pathParameter)));
        }
        paths.addPathItem("/apis/console.api.lingui.acanyo.com/v1alpha1/generation-settings", new PathItem()
            .get(operation("GetLinguiGenerationSettings", "LinguiAi", model(AiEndpoint.GenerationSettings.class))));
        paths.addPathItem("/apis/console.api.lingui.acanyo.com/v1alpha1/generate", new PathItem()
            .post(operation("GenerateLinguiComponent", "LinguiAi", model(AiEndpoint.GenerateResponse.class))
                .requestBody(new RequestBody().required(true).content(content(model(AiEndpoint.GenerateRequest.class))))));
        paths.addPathItem("/apis/console.api.lingui.acanyo.com/v1alpha1/generate-theme", new PathItem()
            .post(operation("GenerateLinguiTheme", "LinguiAi", model(AiEndpoint.GenerateResponse.class))
                .requestBody(new RequestBody().required(true).content(content(model(AiEndpoint.GenerateThemeRequest.class))))));
        var api = new OpenAPI().openapi("3.0.3").info(new Info().title("LingUI management API").version("0.1.0"))
            .components(COMPONENTS).paths(paths);
        var output = Path.of(args[0]); Files.createDirectories(output.getParent()); Files.writeString(output, Json.pretty(api));
    }
}
