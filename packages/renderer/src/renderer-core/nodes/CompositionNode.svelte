<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Section'}
    <section
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-section"
    >
        <header class="lg-section-heading">
            {#if node.label}<p class="lg-eyebrow">{resolve(node.label)}</p>{/if}
            <h2>{resolve(node.title)}</h2>
            {#if node.description}<p class="lg-section-description">
                    {resolve(node.description)}
                </p>{/if}
        </header>
        <div class="lg-section-content">
            {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
        </div>
    </section>
{:else if node.component === 'LingUI.Toolbar'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-toolbar"
        role="group"
        aria-label={String(resolve(node.label) || '操作区')}
    >
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </div>
{:else}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-grid lg-grid-${node.maxColumns ?? 2}`}
    >
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </div>
{/if}
