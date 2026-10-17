<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import { tick, untrack } from 'svelte'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    let expanded = $state(untrack(() => new Set((node.treeItems ?? []).map((item) => item.id))))
    let focused = $state(untrack(() => node.treeItems?.[0]?.id ?? ''))
    let element: HTMLElement
    let value = $derived.by(() => {
        $snapshot
        return resolve(node.value)
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let rows = $derived.by(() => {
        const result: {
            id: string
            label: string
            parent?: string
            level: number
            branch: boolean
        }[] = []
        function visit(parent: string | undefined, level: number) {
            for (const item of node.treeItems ?? [])
                if (item.parent === parent) {
                    const branch = node.treeItems!.some((child) => child.parent === item.id)
                    result.push({ ...item, level, branch })
                    if (expanded.has(item.id)) visit(item.id, level + 1)
                }
        }
        visit(undefined, 1)
        return result
    })
    function select(id: string) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, id)
            nodeEvents.emit('select', { id, value: id })
        } catch (error) {
            report(error)
        }
    }
    function toggle(id: string) {
        const next = new Set(expanded)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        expanded = next
    }
    async function focus(id: string) {
        focused = id
        await tick()
        element.querySelector<HTMLButtonElement>(`[data-tree-id="${id}"]`)?.focus()
    }
    function keyboard(event: KeyboardEvent, index: number) {
        const row = rows[index]!
        if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
            return
        event.preventDefault()
        event.stopPropagation()
        if (event.key === 'ArrowDown') void focus(rows[Math.min(index + 1, rows.length - 1)]!.id)
        if (event.key === 'ArrowUp') void focus(rows[Math.max(index - 1, 0)]!.id)
        if (event.key === 'Home') void focus(rows[0]!.id)
        if (event.key === 'End') void focus(rows.at(-1)!.id)
        if (event.key === 'ArrowRight' && row.branch) {
            if (!expanded.has(row.id)) toggle(row.id)
            else void focus(rows[index + 1]!.id)
        }
        if (event.key === 'ArrowLeft') {
            if (row.branch && expanded.has(row.id)) toggle(row.id)
            else if (row.parent) void focus(row.parent)
        }
    }
</script>

<section data-lingui-node={node.id} class="lg-tree-view" bind:this={element}>
    <h3 class="lg-data-heading" id={`${prefix}-${node.id}-label`}>{label}</h3>
    <div role="tree" aria-labelledby={`${prefix}-${node.id}-label`} aria-disabled={disabled}>
        {#each rows as row, index (row.id)}
            <button
                type="button"
                role="treeitem"
                data-tree-id={row.id}
                class="lg-tree-row"
                style:--lg-tree-depth={row.level - 1}
                {disabled}
                aria-level={row.level}
                aria-selected={value === row.id}
                aria-expanded={row.branch ? expanded.has(row.id) : undefined}
                tabindex={focused === row.id ||
                (!rows.some((row) => row.id === focused) && index === 0)
                    ? 0
                    : -1}
                onfocus={() => (focused = row.id)}
                onclick={() => {
                    select(row.id)
                    if (row.branch) toggle(row.id)
                }}
                onkeydown={(event) => keyboard(event, index)}
            >
                <span aria-hidden="true" class="lg-tree-mark"
                    >{row.branch ? (expanded.has(row.id) ? '⌄' : '›') : '·'}</span
                ><span>{row.label}</span>{#if value === row.id}<span
                        aria-hidden="true"
                        class="lg-tree-check">✓</span
                    >{/if}
            </button>
        {/each}
    </div>
</section>
