<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve } = useRenderer()
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.InlineCode'}
    <code
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-inline-code">{$snapshot && resolve(node.text)}</code
    >
{:else}
    <mark
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-highlight lg-highlight-${node.tone ?? 'accent'}`}
        >{$snapshot && resolve(node.text)}</mark
    >
{/if}
