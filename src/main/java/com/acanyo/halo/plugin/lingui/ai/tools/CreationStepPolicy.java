package com.acanyo.halo.plugin.lingui.ai.tools;

import java.util.ArrayList;
import run.halo.aifoundation.chat.PreparedStep;
import run.halo.aifoundation.chat.StepContext;
import run.halo.aifoundation.message.ModelMessage;
import run.halo.aifoundation.message.ModelMessageRole;

/** Keeps tool definitions stable while directing later rounds toward a complete validated artifact. */
public final class CreationStepPolicy {
    private CreationStepPolicy() {}

    public static PreparedStep prepare(StepContext step, String system) {
        if (step.getStepIndex() < 2) return PreparedStep.empty();
        var messages = new ArrayList<>(step.getMessages() == null ? java.util.List.<ModelMessage>of() : step.getMessages());
        String reminder = step.getStepIndex() >= 4
            ? "查询阶段已经结束。现在必须调用 validate_design，以 nodes 组件数组和 finalize=true 提交完整设计；若上一轮校验失败，保留需求功能，只修正具体问题。不得提交测试或问候文档，不得删掉接口或交互来通过校验。不要新增功能或重复搜索目录。"
            : "现在进入实现阶段。使用已获得的组件与规则完成设计，优先用 nodes 组件数组调用 validate_design，最终提交 finalize=true；只补查缺失的具体 schema，不再搜索目录。";
        var instruction = ModelMessage.system(system + "\n\n本轮流程要求（第 " + (step.getStepIndex() + 1) + " 轮）：" + reminder);
        int systemIndex = -1;
        for (int index = 0; index < messages.size(); index++)
            if (messages.get(index).getRole() == ModelMessageRole.SYSTEM) { systemIndex = index; break; }
        if (systemIndex < 0) messages.addFirst(instruction);
        else messages.set(systemIndex, instruction);
        return PreparedStep.builder().messages(messages).build();
    }
}
