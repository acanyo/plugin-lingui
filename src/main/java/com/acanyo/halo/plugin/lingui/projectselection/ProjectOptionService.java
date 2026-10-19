package com.acanyo.halo.plugin.lingui.projectselection;

import com.acanyo.halo.plugin.lingui.model.ComponentEmbed;
import com.acanyo.halo.plugin.lingui.model.ComponentTemplate;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import reactor.core.publisher.Mono;
import run.halo.app.extension.ListOptions;
import run.halo.app.extension.ReactiveExtensionClient;

@Service
public class ProjectOptionService {
    private static final Pattern NAME = Pattern.compile("[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?");
    private static final Comparator<ProjectOption> ORDER = Comparator
        .comparing(ProjectOption::displayName).thenComparing(ProjectOption::id);
    private final ReactiveExtensionClient client;

    public ProjectOptionService(ReactiveExtensionClient client) {
        this.client = client;
    }

    public Mono<ProjectOptionList> list(int page, int size, String keyword, String category,
        boolean publicOnly) {
        if (page < 1 || size < 1 || size > 100) throw bad("分页参数无效");
        String query = filterText(keyword, 120, "关键词").toLowerCase(Locale.ROOT);
        String requestedCategory = filterText(category, 80, "分类");
        return enabledNames().flatMap(enabled -> client
            .listAll(ComponentTemplate.class, ListOptions.builder().build(), Sort.unsorted())
            .filter(ProjectOptionService::validProject)
            .map(project -> option(project, enabled.contains(project.getMetadata().getName())))
            .filter(option -> !publicOnly || option.embedEnabled())
            .filter(option -> requestedCategory.isEmpty() || requestedCategory.equals(option.category()))
            .filter(option -> matches(option, query))
            .sort(ORDER)
            .collectList()
            .map(options -> {
                long start = (long) (page - 1) * size;
                int from = (int) Math.min(start, options.size());
                int to = (int) Math.min(start + size, options.size());
                return new ProjectOptionList(List.copyOf(options.subList(from, to)), page, size,
                    options.size());
            }));
    }

    public Mono<ProjectOption> get(String name, boolean publicOnly) {
        if (!validName(name)) throw bad("组件 ID 无效");
        return client.fetch(ComponentEmbed.class, name)
            .filter(ProjectOptionService::enabledEmbed)
            .filter(embed -> name.equals(embed.getMetadata().getName()))
            .map(ignored -> true)
            .defaultIfEmpty(false)
            .flatMap(enabled -> {
                if (publicOnly && !enabled) return Mono.error(missing());
                return client.fetch(ComponentTemplate.class, name)
                    .filter(ProjectOptionService::validProject)
                    .filter(project -> name.equals(project.getMetadata().getName()))
                    .map(project -> option(project, enabled))
                    .switchIfEmpty(Mono.error(missing()));
            });
    }

    private Mono<Set<String>> enabledNames() {
        return client.listAll(ComponentEmbed.class, ListOptions.builder().build(), Sort.unsorted())
            .filter(ProjectOptionService::enabledEmbed)
            .map(embed -> embed.getMetadata().getName())
            .collect(java.util.stream.Collectors.toSet());
    }

    private static ProjectOption option(ComponentTemplate project, boolean enabled) {
        var spec = project.getSpec();
        return new ProjectOption(project.getMetadata().getName(), spec.getDisplayName().strip(),
            safe(spec.getCategory()).strip(), safe(spec.getDescription()), spec.getRevision(), enabled);
    }

    private static boolean validProject(ComponentTemplate project) {
        if (project.getMetadata() == null || !validName(project.getMetadata().getName())
            || project.getMetadata().getDeletionTimestamp() != null || project.getSpec() == null) {
            return false;
        }
        var spec = project.getSpec();
        return spec.getDisplayName() != null && !spec.getDisplayName().isBlank()
            && spec.getDisplayName().length() <= 120 && spec.getRevision() != null
            && spec.getRevision() > 0 && safe(spec.getCategory()).length() <= 80
            && safe(spec.getDescription()).length() <= 500;
    }

    private static boolean enabledEmbed(ComponentEmbed embed) {
        return embed.getMetadata() != null && validName(embed.getMetadata().getName())
            && embed.getMetadata().getDeletionTimestamp() == null && embed.getSpec() != null
            && Boolean.TRUE.equals(embed.getSpec().getEnabled());
    }

    private static boolean matches(ProjectOption option, String query) {
        if (query.isEmpty()) return true;
        return String.join(" ", option.id(), option.displayName(), option.category(),
            option.description()).toLowerCase(Locale.ROOT).contains(query);
    }

    private static String filterText(String value, int maxLength, String label) {
        String text = safe(value).strip();
        if (text.length() > maxLength) throw bad(label + "过长");
        return text;
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }

    private static boolean validName(String name) {
        return name != null && NAME.matcher(name).matches();
    }

    private static ResponseStatusException bad(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }

    private static ResponseStatusException missing() {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "组件不存在或未开启公开嵌入");
    }
}
