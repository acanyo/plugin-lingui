package com.acanyo.halo.plugin.lingui.ai.validation;

import static com.acanyo.halo.plugin.lingui.ai.validation.ValidationErrors.bad;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Set;

/** Cross-field rules for bounded trees, fixed splits and local task boards. */
final class WorkspaceComponentValidator {
    private static final Set<String> UNSAFE = Set.of("__proto__", "constructor", "prototype");
    private WorkspaceComponentValidator() {}

    static void validate(JsonNode node) {
        String type = node.path("component").asText();
        if (type.equals("LingUI.Calendar") && node.path("month").asText().startsWith("0000")) throw bad("日历年份无效");
        if (type.equals("LingUI.SplitPane") && node.path("children").path(0).equals(node.path("children").path(1))) throw bad("分栏内容不能重复");
        if (node.has("treeItems")) validateTree(node.path("treeItems"));
        if (node.has("boards")) {
            var ids = new HashSet<String>();
            int count = 0;
            for (var board : node.path("boards")) {
                uniqueId(ids, board);
                for (var card : board.path("cards")) { uniqueId(ids, card); count++; }
            }
            if (count > 24) throw bad("看板最多支持 24 个任务");
        }
    }

    private static void uniqueId(Set<String> ids, JsonNode item) {
        String id = item.path("id").asText();
        if (UNSAFE.contains(id) || !ids.add(id)) throw bad("看板与任务标识必须安全且唯一");
    }

    private static void validateTree(JsonNode items) {
        var index = new HashMap<String, JsonNode>();
        for (var item : items) if (index.put(item.path("id").asText(), item) != null) throw bad("树节点标识不能重复");
        for (var item : items) {
            var visited = new HashSet<String>();
            JsonNode current = item;
            while (current != null) {
                String id = current.path("id").asText();
                if (UNSAFE.contains(id) || !visited.add(id)) throw bad("树节点标识无效或存在循环");
                if (visited.size() > 8) throw bad("树导航最多支持 8 层");
                if (current.has("parent") && !index.containsKey(current.path("parent").asText())) throw bad("树节点的父级不存在");
                current = current.has("parent") ? index.get(current.path("parent").asText()) : null;
            }
        }
    }
}
