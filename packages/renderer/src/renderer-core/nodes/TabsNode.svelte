<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, prefix, report, resolve: resolveValue } = useRenderer()
    let localIndex = $state(0)
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let selected = $derived(
        Math.max(
            0,
            Math.min(
                node.tabs!.length - 1,
                Math.floor(Number(node.value ? resolve(node.value) : localIndex)) || 0,
            ),
        ),
    )
    function set(index: number) {
        try {
            if (node.value) nodeEvents.set(node.value as Binding, index)
            else {
                const previousValue = localIndex
                localIndex = index
                if (index !== previousValue)
                    nodeEvents.emit('change', { value: index, previousValue })
            }
        } catch (error) {
            report(error)
        }
    }
    function tabKey(event: KeyboardEvent, index: number) {
        const count = node.tabs!.length
        const target = {
            ArrowRight: (index + 1) % count,
            ArrowLeft: (index - 1 + count) % count,
            Home: 0,
            End: count - 1,
        }[event.key]
        if (target === undefined) return
        event.preventDefault()
        set(target)
        const tabs = (
            event.currentTarget as HTMLElement
        ).parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')
        tabs?.[target]?.focus()
    }
    const { motionEnter, motionExit, motionFeedback, motionTab } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-tabs"
>
    <div role="tablist" class="lg-tablist">
        {#each node.tabs ?? [] as tab, index (tab.child)}<button
                id={`${prefix}-${node.id}-tab-${index}`}
                role="tab"
                type="button"
                aria-selected={selected === index}
                aria-controls={`${prefix}-${node.id}-panel-${index}`}
                tabindex={selected === index ? 0 : -1}
                onclick={() => set(index)}
                onkeydown={(event) => tabKey(event, index)}>{resolve(tab.title)}</button
            >{/each}
    </div>
    {#each node.tabs ?? [] as tab, index (tab.child)}<div
            id={`${prefix}-${node.id}-panel-${index}`}
            role="tabpanel"
            use:motionTab={{ active: selected === index, transition: node.motion?.transition }}
            aria-labelledby={`${prefix}-${node.id}-tab-${index}`}
            tabindex="0"
        >
            <NodeRenderer id={tab.child} />
        </div>{/each}
</div>
