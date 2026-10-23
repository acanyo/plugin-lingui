<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { pageNumber, pageItems } from '../inputs/values'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve, report } = useRenderer()
    let total = $derived(node.totalPages ?? 1)
    let page = $derived.by(() => {
        $snapshot
        return pageNumber(resolve(node.value), total)
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    function set(value: number) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, pageNumber(value, total))
        } catch (error) {
            report(error)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<nav
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-pagination"
    aria-label={String(resolve(node.label) || '分页')}
>
    <div class="lg-pagination-buttons">
        <button
            type="button"
            disabled={disabled || page === 1}
            aria-label="上一页"
            onclick={() => set(page - 1)}>‹</button
        >
        {#each pageItems(page, total) as item (item)}
            {#if typeof item === 'number'}<button
                    type="button"
                    {disabled}
                    aria-label={`第 ${item} 页`}
                    aria-current={page === item ? 'page' : undefined}
                    onclick={() => set(item)}>{item}</button
                >
            {:else}<span class="lg-pagination-gap" aria-hidden="true">…</span>{/if}
        {/each}
        <button
            type="button"
            disabled={disabled || page === total}
            aria-label="下一页"
            onclick={() => set(page + 1)}>›</button
        >
    </div>
    <span class="lg-caption" aria-live="polite">第 {page} / {total} 页</span>
</nav>
