<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import { tick } from 'svelte'
    import type { Binding, ComponentNode, JsonValue } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let container: HTMLDivElement | undefined = $state()
    let fields = $derived(node.fields ?? [])
    let value = $derived.by(() => {
        $snapshot
        return resolve(node.value)
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled)) || !!node.readOnly
    })
    let rows = $derived(
        Array.isArray(value)
            ? value.filter(
                  (row): row is Record<string, JsonValue> =>
                      !!row && typeof row === 'object' && !Array.isArray(row),
              )
            : [],
    )
    let id = $derived(`${prefix}-${node.id}`)
    function set(rows: Record<string, JsonValue>[]) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, rows)
        } catch (cause) {
            report(cause)
        }
    }
    async function focusRow(index: number) {
        await tick()
        container
            ?.querySelector<HTMLInputElement>(`[data-dynamic-row="${index}"] input`)
            ?.focus({ preventScroll: true })
    }
    function add() {
        if (rows.length >= (node.maxRows ?? 10)) return
        const index = rows.length
        set([...rows, Object.fromEntries(fields.map((field) => [field.key, '']))])
        nodeEvents.emit('add', { index })
        void focusRow(index)
    }
    function move(index: number, direction: number) {
        const target = index + direction
        if (target < 0 || target >= rows.length) return
        const next = [...rows]
        ;[next[index], next[target]] = [next[target]!, next[index]!]
        set(next)
        nodeEvents.emit('reorder', { from: index, to: target })
        void focusRow(target)
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    bind:this={container}
    class={`lg-field lg-dynamic-input lg-size-${node.size ?? 'medium'} lg-field-status-${node.status ?? 'default'}`}
    role="group"
    aria-labelledby={`${id}-label`}
>
    <div class="lg-field-heading">
        <span id={`${id}-label`}>{label}</span><span class="lg-caption" aria-live="polite"
            >{rows.length} / {node.maxRows ?? 10}</span
        >
    </div>
    {#each rows as row, index}<div class="lg-dynamic-row" data-dynamic-row={index}>
            <span class="lg-dynamic-index" aria-hidden="true">{index + 1}</span>
            <div class="lg-dynamic-fields">
                {#each fields as field (field.key)}<label class="lg-field"
                        ><span>{field.label}</span><input
                            type="text"
                            value={String(row[field.key] ?? '')}
                            placeholder={field.placeholder}
                            {disabled}
                            maxlength="500"
                            aria-label={`第 ${index + 1} 行 ${field.label}`}
                            oninput={(event) =>
                                set(
                                    rows.map((item, i) =>
                                        i === index
                                            ? { ...item, [field.key]: event.currentTarget.value }
                                            : item,
                                    ),
                                )}
                        /></label
                    >{/each}
            </div>
            <div class="lg-dynamic-actions">
                <button
                    type="button"
                    class="lg-input-clear"
                    disabled={disabled || index === 0}
                    aria-label={`上移第 ${index + 1} 行`}
                    onclick={() => move(index, -1)}>↑</button
                >
                <button
                    type="button"
                    class="lg-input-clear"
                    disabled={disabled || index === rows.length - 1}
                    aria-label={`下移第 ${index + 1} 行`}
                    onclick={() => move(index, 1)}>↓</button
                >
                <button
                    type="button"
                    class="lg-input-clear"
                    disabled={disabled || rows.length <= (node.minRows ?? 0)}
                    aria-label={`移除第 ${index + 1} 行`}
                    onclick={() => {
                        set(rows.filter((_, i) => i !== index))
                        nodeEvents.emit('remove', { index })
                        void focusRow(Math.max(0, index - 1))
                    }}><LinguiIcon name="close" /></button
                >
            </div>
        </div>{/each}
    {#if !rows.length}<p class="lg-dynamic-empty">还没有条目，添加一行开始填写。</p>{/if}
    <button
        type="button"
        class="lg-button lg-button-secondary lg-dynamic-add"
        disabled={disabled || rows.length >= (node.maxRows ?? 10)}
        onclick={add}>+ {node.addText || '添加一行'}</button
    >
    {#if node.hint}<p class="lg-caption">{node.hint}</p>{/if}
</div>
