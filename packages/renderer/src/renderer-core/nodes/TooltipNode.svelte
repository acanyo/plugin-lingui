<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { bindEscapeScope } from '../inputs/escape-scope'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue, prefix } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let hovered = $state(false),
        focused = $state(false),
        pinned = $state(false),
        dismissed = $state(false)
    let open = $derived((hovered || focused || pinned) && !dismissed)
    let element = $state<HTMLDivElement>()
    $effect(() => {
        if (!element) return
        return bindEscapeScope(
            element,
            () => open,
            () => {
                dismissed = true
                pinned = false
            },
        )
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    bind:this={element}
    class="lg-tooltip"
    data-lingui-escape-scope={open ? 'open' : undefined}
    role="group"
    onpointerenter={() => {
        hovered = true
        dismissed = false
    }}
    onpointerleave={() => {
        hovered = false
    }}
>
    <button
        type="button"
        class="lg-tooltip-trigger"
        aria-describedby={`${prefix}-${node.id}-tip`}
        onfocus={() => {
            focused = true
            dismissed = false
        }}
        onblur={() => {
            focused = false
            pinned = false
        }}
        onclick={() => {
            pinned = !pinned
            dismissed = !pinned
        }}
    >
        <span class="lg-tooltip-icon" aria-hidden="true">?</span><span>{resolve(node.label)}</span>
    </button>
    <span id={`${prefix}-${node.id}-tip`} class="lg-tooltip-content" role="tooltip" hidden={!open}
        >{resolve(node.text)}</span
    >
</div>
