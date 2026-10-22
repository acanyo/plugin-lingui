package com.acanyo.halo.plugin.lingui.ai.tools;

import com.acanyo.halo.plugin.lingui.ai.validation.DesignValidator;
import com.acanyo.halo.plugin.lingui.ai.validation.ApiBindingValidator;
import com.acanyo.halo.plugin.lingui.ai.validation.RuntimePreflightValidator;
import com.acanyo.halo.plugin.lingui.ai.validation.CreationRequirements;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;
import run.halo.aifoundation.tool.ToolDefinition;

/** One tool contract shared by Foundation executors and the MCP adapter. No mutation tools. */
@Component
public class CreationTools {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(CreationTools.class);
    private final ComponentCatalog catalog;
    private final PublicApiCatalog publicApiCatalog;
    private final SiteReferenceTools siteReferences;
    private final ContentReferenceTools contentReferences;
    private final ApiBindingValidator apiBindingValidator;
    private final RuntimePreflightValidator runtimePreflightValidator;
    private final SkillResources resources;
    private final DesignValidator validator;
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<Definition> definitions;

    @Autowired
    public CreationTools(ComponentCatalog catalog, PublicApiCatalog publicApiCatalog,
        SiteReferenceTools siteReferences, ContentReferenceTools contentReferences,
        SkillResources resources, DesignValidator validator) {
        this.catalog = catalog;
        this.publicApiCatalog = publicApiCatalog;
        this.siteReferences = siteReferences;
        this.contentReferences = contentReferences;
        this.apiBindingValidator = publicApiCatalog == null ? null : new ApiBindingValidator(publicApiCatalog);
        this.runtimePreflightValidator = new RuntimePreflightValidator();
        this.resources = resources;
        this.validator = validator;
        var definitions = new java.util.ArrayList<Definition>();
        definitions.add(new Definition("search_components", "按中文用途或组件名称搜索全部组件；query 为空可分页浏览目录。", schema(
                Map.of("query", Map.of("type", "string", "maxLength", 120),
                    "offset", Map.of("type", "integer", "minimum", 0, "maximum", 105),
                    "limit", Map.of("type", "integer", "minimum", 1, "maximum", 30)), List.of())));
        definitions.add(new Definition("get_component_schemas", "批量读取 1–12 个组件的完整参数、动作、绑定及引用定义。用真实 schema，不能猜测字段。", schema(
                Map.of("names", Map.of("type", "array", "items", Map.of("type", "string", "maxLength", 80),
                    "minItems", 1, "maxItems", 12, "uniqueItems", true)), List.of("names"))));
        definitions.add(new Definition("get_current_work", "获取当前请求的完整作品快照；外部 MCP 必须提供已保存作品的 workName，不读取浏览器状态。", schema(
                Map.of("workName", Map.of("type", "string", "minLength", 1, "maxLength", 160,
                    "pattern", "^[a-zA-Z0-9][a-zA-Z0-9._-]*$")), List.of())));
        definitions.add(new Definition("get_guidance", "先读取 skill 创作入口；按需读取 interactions 交互、theme 主题、data 动态数据、layout 布局，或 examples 经校验的接口重试/测验/指标布局范例。只读取与当前需求相关的参考。", schema(
                Map.of("topic", Map.of("type", "string", "enum", List.of("skill", "interactions", "theme", "data", "layout", "examples"))), List.of("topic"))));
        definitions.add(new Definition("validate_design", "校验设计并返回具体问题。推荐 document.nodes 组件对象数组（工具自动生成 OpenUI source），也接受标准 source。外部 MCP 校验通过时在 design 返回标准设计。只有最终完整作品设置 finalize=true，试校验省略或设 false。不会保存或执行。", schema(
                Map.of("design", Map.of("type", "object"), "finalize", Map.of("type", "boolean")), List.of("design"))));
        if (publicApiCatalog != null) definitions.addAll(ApiReferenceTools.definitions());
        if (siteReferences != null) definitions.addAll(SiteReferenceTools.definitions());
        if (contentReferences != null) definitions.addAll(ContentReferenceTools.definitions());
        this.definitions = List.copyOf(definitions);
    }

    /** Compatibility constructor for isolated validator tests that do not create a Spring context. */
    public CreationTools(ComponentCatalog catalog, SkillResources resources, DesignValidator validator) {
        this(catalog, null, null, null, resources, validator);
    }

    private static Map<String, Object> schema(Map<String, Object> properties, List<String> required) {
        return Map.of("type", "object", "properties", properties, "required", required, "additionalProperties", false);
    }

    public List<Definition> definitions() { return definitions; }

    public List<ToolDefinition> forGeneration(String snapshot) {
        return session(snapshot).tools();
    }

    public CreationSession session(String snapshot) {
        return session(snapshot, null);
    }

    public CreationSession session(String snapshot, String instruction) {
        var count = new AtomicInteger();
        var accepted = new java.util.concurrent.atomic.AtomicReference<String>();
        var context = new WorkContext(snapshot, null);
        var requirements = new CreationRequirements(instruction);
        var sessionTools = definitions.stream().map(tool -> ToolDefinition.builder().name(tool.name())
            .description(tool.description()).inputSchema(tool.inputSchema())
            .executor(call -> count.incrementAndGet() > 18
                ? Mono.just(Map.of("isError", true, "message", "本次工具调用已达上限，请完成输出"))
                : call(tool.name(), call.getInput(), context)
                    .map(result -> {
                        if (tool.name().equals("validate_design")) {
                            var validation = mapper.valueToTree(result);
                            boolean valid = validation.path("valid").asBoolean(false);
                            if (valid) {
                                var design = validator.normalizeToolDesign(mapper.valueToTree(call.getInput().get("design")));
                                try { requirements.requireValid(design); }
                                catch (IllegalArgumentException issue) {
                                    valid = false;
                                    result = Map.of("valid", false, "issues", List.of(Map.of("message", issue.getMessage())));
                                }
                                if (valid && Boolean.TRUE.equals(call.getInput().get("finalize"))) accepted.set(design.toString());
                                else if (valid) result = Map.of("valid", true, "finalized", false,
                                    "message", "仅完成预检，生成尚未结束。确认完整需求均已实现后用 finalize=true 提交完整设计");
                            }
                            LOG.info("Lingui design preflight completed: valid={}, issues={}", valid,
                                mapper.valueToTree(result).path("issues").size());
                        }
                        LOG.info("Lingui creation tool completed: name={}, call={}, resultBytes={}", tool.name(),
                            count.get(), mapper.valueToTree(result).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8).length);
                        return result;
                    }))
            .build()).toList();
        return new CreationSession(sessionTools, accepted, text -> {
            String clean = text.strip().replaceFirst("(?i)^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
            var design = validator.parse(clean);
            validator.requireValid(design);
            if (apiBindingValidator != null) apiBindingValidator.requireValid(design);
            runtimePreflightValidator.requireValid(design);
            requirements.requireValid(design);
            return design.toString();
        });
    }

    public Mono<Object> call(String name, Map<String, Object> arguments, WorkContext context) {
        return Mono.defer(() -> {
            var definition = definitions.stream().filter(tool -> tool.name().equals(name)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("未知工具：" + name));
            var input = mapper.valueToTree(arguments == null ? Map.of() : arguments);
            if (input.toString().length() > 262144) throw new IllegalArgumentException("工具参数过大");
            var schema = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V202012)
                .getSchema(mapper.valueToTree(definition.inputSchema()));
            var errors = schema.validate(input);
            if (!errors.isEmpty()) throw new IllegalArgumentException(errors.iterator().next().getMessage());
            return switch (name) {
                case "search_components" -> Mono.just(catalog.search(input.path("query").asText(""),
                    input.path("offset").asInt(0), input.path("limit").asInt(20)));
                case "get_component_schemas" -> {
                    var names = new java.util.ArrayList<String>();
                    input.path("names").forEach(item -> names.add(item.asText()));
                    yield Mono.just(catalog.schemas(names));
                }
                case "search_public_apis" -> publicApiCatalog == null
                    ? Mono.error(new IllegalStateException("API 目录仅在 Halo 运行环境中可用"))
                    : Mono.fromCallable(() -> publicApiCatalog.search(
                        input.path("query").asText(""), input.path("limit").asInt(8)));
                case "get_public_api" -> publicApiCatalog == null
                    ? Mono.error(new IllegalStateException("API 目录仅在 Halo 运行环境中可用"))
                    : Mono.fromCallable(() -> publicApiCatalog.details(ApiReferenceTools.ids(input)));
                case "get_site_profile", "get_navigation" -> siteReferences == null
                    ? Mono.error(new IllegalStateException("站点资料仅在 Halo 运行环境中可用"))
                    : siteReferences.execute(name, arguments == null ? Map.of() : arguments);
                case "read_content", "search_attachments" -> contentReferences == null
                    ? Mono.error(new IllegalStateException("内容资料仅在 Halo 运行环境中可用"))
                    : contentReferences.execute(name, arguments == null ? Map.of() : arguments);
                case "get_guidance" -> Mono.just(Map.of("text", resources.get(input.path("topic").asText())));
                case "validate_design" -> {
                    var design = validator.normalizeToolDesign(input.path("design"));
                    var feedback = (com.fasterxml.jackson.databind.node.ObjectNode) mapper.valueToTree(validator.validate(design));
                    if (feedback.path("valid").asBoolean(false) && apiBindingValidator != null) {
                        var apiIssues = apiBindingValidator.validate(design);
                        if (!apiIssues.isEmpty()) {
                            feedback.put("valid", false);
                            feedback.set("issues", mapper.valueToTree(apiIssues));
                        }
                    }
                    if (feedback.path("valid").asBoolean(false)) {
                        var runtime = runtimePreflightValidator.inspect(design);
                        feedback.set("runtime", mapper.valueToTree(runtime));
                        if (!runtime.issues().isEmpty()) {
                            feedback.put("valid", false);
                            feedback.set("issues", mapper.valueToTree(runtime.issues()));
                        }
                    }
                    // External clients need the canonical source to export a tool-only nodes design.
                    if (context.reader() != null && feedback.path("valid").asBoolean(false))
                        feedback.set("design", design);
                    yield Mono.just(feedback);
                }
                case "get_current_work" -> {
                    if (context.reader() != null) {
                        if (!input.has("workName")) throw new IllegalArgumentException("外部 MCP 请提供 workName；无法读取浏览器未保存的内容");
                        yield context.reader().apply(input.path("workName").asText());
                    }
                    if (input.has("workName")) throw new IllegalArgumentException("工作台仅允许读取本次请求的快照，无需 workName");
                    yield Mono.just(context.document() == null || context.document().isBlank()
                        ? Map.of("status", "empty", "message", "本次为新建作品")
                        : Map.of("document", validator.parse(context.document())));
                }
                default -> Mono.error(new IllegalArgumentException("未知工具"));
            };
        }).map(result -> mapper.convertValue(result, Object.class))
            .subscribeOn(Schedulers.boundedElastic()).onErrorResume(IllegalArgumentException.class,
            error -> Mono.just(Map.of("isError", true, "message", error.getMessage())));
    }

    public record Definition(String name, String description, Map<String, Object> inputSchema) {}
    public record WorkContext(String document, Function<String, Mono<Object>> reader) {}
}
