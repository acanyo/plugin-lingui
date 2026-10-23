<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.ScrollArea'}
    <section
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-scroll-frame"
    >
        <h3 class="lg-data-heading">{node.label}</h3>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Named scroll region must be keyboard scrollable.) -->
        <div
            class={`lg-scroll-area lg-scroll-${node.maxHeight ?? 240}`}
            role="region"
            aria-label={String(node.label ?? '')}
            tabindex="0"
        >
            <NodeRenderer id={node.child!} />
        </div>
    </section>
{:else}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-aspect-ratio lg-aspect-${node.ratio ?? 'wide'}`}
    >
        <NodeRenderer id={node.child!} />
    </div>
{/if}
