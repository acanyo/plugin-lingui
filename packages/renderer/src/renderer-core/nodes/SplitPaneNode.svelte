<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    import { rangePercent } from '../inputs/ranges'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    let value = $derived.by(() => {
        $snapshot
        const value = resolve(node.value)
        return typeof value === 'number' && Number.isFinite(value)
            ? Math.max(20, Math.min(80, value))
            : 50
    })
    function set(value: number) {
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
</script>

<section data-lingui-node={node.id} class="lg-split-pane">
    <div class="lg-split-heading">
        <h3 class="lg-data-heading">{$snapshot && resolve(node.label)}</h3>
        <label for={`${prefix}-${node.id}`} class="lg-caption"
            >分栏比例 {Math.round(value)} : {Math.round(100 - value)}</label
        >
    </div>
    <input
        id={`${prefix}-${node.id}`}
        class="lg-split-range"
        type="range"
        aria-label="调整分栏比例"
        min="20"
        max="80"
        step="1"
        {value}
        style:--lg-range-fill={`${rangePercent(value, 20, 80)}%`}
        oninput={(event) => set(Number(event.currentTarget.value))}
    />
    <div
        class="lg-split-panels"
        style:grid-template-columns={`minmax(0, ${value}fr) minmax(0, ${100 - value}fr)`}
    >
        {#each node.children ?? [] as child (child)}<div class="lg-split-panel">
                <NodeRenderer id={child} />
            </div>{/each}
    </div>
</section>
