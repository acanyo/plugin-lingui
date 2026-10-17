<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import NodeRenderer from '../NodeRenderer.svelte'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: ComponentNode['value']) {
        $snapshot
        return resolveValue(value)
    }
</script>

{#if node.component === 'LingUI.Timeline'}<ol data-lingui-node={node.id} class="lg-timeline">
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </ol>{:else}<li data-lingui-node={node.id} class="lg-timeline-item">
        <span class="lg-timeline-dot" aria-hidden="true"></span>
        <h3>{resolve(node.title)}</h3>
        {#if node.description}<p class="lg-muted">
                {resolve(node.description)}
            </p>{/if}{#if node.child}<NodeRenderer id={node.child} />{/if}
    </li>{/if}
