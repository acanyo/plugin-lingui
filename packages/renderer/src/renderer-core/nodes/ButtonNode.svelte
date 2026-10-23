<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import NodeRenderer from '../NodeRenderer.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { runtime, state: snapshot, resolve, report, busy } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let loading = $derived.by(() => {
        $snapshot
        return Boolean(resolve(node.loading)) || $busy.has(node.id)
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled)) || loading
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    function click() {
        if (disabled) return
        try {
            if (node.action) runtime.dispatch(node.action)
        } catch (cause) {
            report(cause)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<button
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    type={node.buttonType ?? 'button'}
    class={`lg-button lg-button-${node.variant ?? 'secondary'} lg-size-${node.size ?? 'medium'} lg-button-tone-${node.tone ?? 'info'}`}
    class:lg-icon-button={node.component === 'LingUI.IconButton'}
    {disabled}
    aria-busy={loading || undefined}
    aria-label={node.component === 'LingUI.IconButton' ? label : undefined}
    title={node.component === 'LingUI.IconButton' ? label : undefined}
    onclick={click}
>
    {#if loading}<span class="lg-button-spinner" aria-hidden="true"></span>{/if}
    {#if node.component === 'LingUI.IconButton'}<LinguiIcon name={node.name!} />{:else}<NodeRenderer
            id={node.child!}
        />{/if}
</button>
