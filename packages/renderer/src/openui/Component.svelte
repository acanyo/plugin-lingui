<script lang="ts">
    import DataBoundNode from '../renderer-core/DataBoundNode.svelte'
    import type { Snippet } from 'svelte'
    import { componentRegistry } from '../renderer-core/registry'
    import type { ComponentNode } from '../protocol/types'
    import { useRenderer } from '../renderer-core/context'
    import { provideOpenuiChildren } from './render-context'
    let {
        props,
        renderNode,
    }: {
        props: { config: { id: string }; content: unknown[] }
        renderNode: Snippet<[unknown]>
    } = $props()
    const { surface } = useRenderer()
    const node = $derived(surface.nodes[props.config.id] as ComponentNode)
    const Implementation = $derived(node ? componentRegistry[node.component] : undefined)
    const initial = (() => ({ content: props.content, renderNode }))()
    provideOpenuiChildren(initial.content, initial.renderNode)
</script>

{#if node && Implementation}{#if node.bindings || node.dataState}<DataBoundNode
            {node}
            implementation={Implementation}
        />{:else}<Implementation {node} />{/if}{/if}
