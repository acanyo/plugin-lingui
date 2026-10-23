<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { onDestroy } from 'svelte'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useNodeEvents } from '../../events/node'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { surface, prefix, state: snapshot, resolve } = useRenderer()
    let dialog: HTMLDialogElement
    let trigger = $state<HTMLDivElement>()
    let container = $state<HTMLDivElement>()
    let consumeEscape = false
    let focusTarget: HTMLElement | undefined
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '详细内容')
    })
    let buttonTrigger = $derived(surface.nodes[node.trigger!]?.component === 'Button')
    let drawer = $derived(node.component === 'LingUI.Drawer')
    function open(event: Event) {
        event.preventDefault()
        event.stopPropagation()
        if (dialog.open) return
        if (!trigger) return
        const active = (trigger.getRootNode() as ShadowRoot).activeElement as HTMLElement | null
        if (active?.closest(':disabled')) return
        focusTarget =
            active && trigger.contains(active)
                ? active
                : (trigger.querySelector<HTMLElement>('button') ?? trigger)
        dialog.showModal()
        nodeEvents.emit('open', { open: true })
    }
    function keyboard(event: KeyboardEvent) {
        if (!buttonTrigger && ['Enter', ' '].includes(event.key)) open(event)
    }
    function restoreFocus() {
        nodeEvents.emit('close', { open: false })
        if (focusTarget?.isConnected) focusTarget.focus()
    }
    $effect(() => {
        const target = trigger
        if (!target) return
        target.addEventListener('click', open, { capture: true })
        const button = target.querySelector('button')
        if (button) {
            button.setAttribute('aria-haspopup', 'dialog')
            button.setAttribute('aria-controls', `${prefix}-${node.id}-dialog`)
        }
        return () => target.removeEventListener('click', open, { capture: true })
    })
    $effect(() => {
        const target = container
        if (!target) return
        function keydown(event: KeyboardEvent) {
            if (!dialog.open) return
            if (event.key === 'Escape') consumeEscape = true
            event.stopPropagation()
        }
        function keyup(event: KeyboardEvent) {
            if (consumeEscape && event.key === 'Escape') {
                consumeEscape = false
                event.stopPropagation()
            } else if (dialog.open) event.stopPropagation()
        }
        target.addEventListener('keydown', keydown)
        target.addEventListener('keyup', keyup)
        return () => {
            target.removeEventListener('keydown', keydown)
            target.removeEventListener('keyup', keyup)
        }
    })
    onDestroy(() => {
        if (dialog?.open) dialog.close()
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    bind:this={container}
    class="lg-modal"
>
    {#if buttonTrigger}
        <div
            bind:this={trigger}
            class="lg-modal-trigger"
            role="group"
            aria-controls={`${prefix}-${node.id}-dialog`}
        >
            <NodeRenderer id={node.trigger!} />
        </div>
    {:else}
        <div
            bind:this={trigger}
            class="lg-modal-trigger"
            role="button"
            tabindex="0"
            aria-label={label}
            aria-haspopup="dialog"
            aria-controls={`${prefix}-${node.id}-dialog`}
            onkeydown={keyboard}
        >
            <NodeRenderer id={node.trigger!} />
        </div>
    {/if}
    <dialog
        bind:this={dialog}
        id={`${prefix}-${node.id}-dialog`}
        class={`lg-dialog${drawer ? ` lg-drawer lg-drawer-${node.side ?? 'right'}` : ''}`}
        aria-labelledby={`${prefix}-${node.id}-title`}
        onclose={restoreFocus}
        oncancel={() => nodeEvents.emit('cancel', { reason: 'escape' })}
    >
        <header class="lg-dialog-heading">
            <h2 id={`${prefix}-${node.id}-title`} class="lg-h3">{label}</h2>
            <button
                type="button"
                class="lg-button lg-button-text"
                aria-label={drawer ? '关闭抽屉' : '关闭弹窗'}
                onclick={() => dialog.close()}>关闭</button
            >
        </header>
        <div class="lg-dialog-content"><NodeRenderer id={node.content!} /></div>
    </dialog>
</div>
