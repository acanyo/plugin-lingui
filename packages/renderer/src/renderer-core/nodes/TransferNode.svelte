<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { stringList } from '../inputs/values'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve: resolveValue, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    let selected = $derived(
        stringList(resolve(node.value), 40).filter((value) =>
            node.options?.some((option) => option.value === value),
        ),
    )
    let marked = $state<string[]>([]),
        query = $state('')
    let filtered = $derived(
        (node.options ?? []).filter((option) =>
            option.label.toLowerCase().includes(query.toLowerCase()),
        ),
    )
    function mark(value: string) {
        if (!disabled)
            marked = marked.includes(value)
                ? marked.filter((item) => item !== value)
                : [...marked, value]
    }
    function move(add: boolean) {
        if (disabled) return
        const visible = new Set(filtered.map((item) => item.value))
        const candidates = marked.filter(
            (value) => visible.has(value) && selected.includes(value) !== add,
        )
        const next = add
            ? [...selected, ...candidates]
            : selected.filter((value) => !candidates.includes(value))
        try {
            nodeEvents.set(node.value as Binding, next)
            marked = marked.filter((value) => !candidates.includes(value))
        } catch (error) {
            report(error)
        }
    }
</script>

<fieldset data-lingui-node={node.id} class="lg-transfer" {disabled}>
    <legend>{resolve(node.label)}</legend>
    <label class="lg-field"
        ><span class="lg-sr-only">筛选穿梭选项</span><input
            type="search"
            placeholder="筛选选项"
            bind:value={query}
        /></label
    >
    <div class="lg-transfer-body">
        {#each [false, true] as chosen}
            {#if chosen}<div class="lg-transfer-actions">
                    <button
                        type="button"
                        aria-label="添加到已选"
                        disabled={disabled ||
                            !marked.some(
                                (value) =>
                                    filtered.some((item) => item.value === value) &&
                                    !selected.includes(value),
                            )}
                        onclick={() => move(true)}
                        >添加 <span class="lg-transfer-arrow" aria-hidden="true">→</span></button
                    ><button
                        type="button"
                        aria-label="移回待选"
                        disabled={disabled ||
                            !marked.some(
                                (value) =>
                                    filtered.some((item) => item.value === value) &&
                                    selected.includes(value),
                            )}
                        onclick={() => move(false)}
                        ><span class="lg-transfer-arrow" aria-hidden="true">←</span> 移回</button
                    >
                </div>{/if}
            <section class="lg-transfer-list">
                <h4>
                    {chosen ? node.targetLabel || '已选' : node.sourceLabel || '待选'}<span
                        class="lg-caption"
                        >{(node.options ?? []).filter(
                            (item) => selected.includes(item.value) === chosen,
                        ).length}</span
                    >
                </h4>
                <div class="lg-transfer-options">
                    {#each filtered.filter((option) => selected.includes(option.value) === chosen) as option (option.value)}<label
                            class="lg-multi-option"
                            ><input
                                type="checkbox"
                                checked={marked.includes(option.value)}
                                onchange={() => mark(option.value)}
                            /><span>{option.label}</span></label
                        >{/each}
                    {#if !filtered.some((option) => selected.includes(option.value) === chosen)}<p
                            class="lg-caption"
                        >
                            {query ? '没有匹配的选项' : '暂无选项'}
                        </p>{/if}
                </div>
            </section>
        {/each}
    </div>
    <p class="lg-caption" aria-live="polite">
        已选择 {selected.length} 项，勾选后使用按钮移动。
    </p>
</fieldset>
