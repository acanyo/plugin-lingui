<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { evaluate } from '../../interaction-runtime/expression'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, report } = useRenderer()
    let visible = $derived.by(() => {
        try {
            return node.condition === undefined || Boolean(evaluate(node.condition, $snapshot))
        } catch (error) {
            report(error)
            return false
        }
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if visible}
    {#if node.motion}
        <div
            data-lingui-node={node.id}
            in:motionEnter|global={node.motion?.enter}
            out:motionExit|global={node.motion?.exit}
            use:motionFeedback={node.motion}
            class="lg-conditional"
        >
            <NodeRenderer id={node.child!} />
        </div>
    {:else}<NodeRenderer id={node.child!} />{/if}
{/if}
