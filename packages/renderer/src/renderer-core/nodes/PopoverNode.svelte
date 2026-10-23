<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { onMount, onDestroy, tick } from 'svelte'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useNodeEvents } from '../../events/node'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { state: snapshot, resolve, prefix } = useRenderer()
    let trigger = $state<HTMLDivElement>()
    let container = $state<HTMLDivElement>()
    let panel: HTMLDivElement
    let opened = $state(false),
        left = $state(16),
        top = $state(16)
    let wasOpened = false
    $effect(() => {
        if (wasOpened === opened) return
        wasOpened = opened
        nodeEvents.emit(opened ? 'open' : 'close', { open: opened })
    })
    let focusTarget: HTMLButtonElement | undefined
    let consumeEscape = false
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '补充内容')
    })
    function position() {
        if (!opened || !trigger || !panel) return
        const anchor = trigger.getBoundingClientRect(),
            bounds = panel.getBoundingClientRect()
        left = Math.max(12, Math.min(anchor.left, innerWidth - bounds.width - 12))
        const below = anchor.bottom + 8,
            above = anchor.top - bounds.height - 8
        const preferred = node.placement === 'top' ? above : below
        const alternate = node.placement === 'top' ? below : above
        top = Math.max(
            12,
            Math.min(
                preferred >= 12 && preferred + bounds.height <= innerHeight - 12
                    ? preferred
                    : alternate,
                innerHeight - bounds.height - 12,
            ),
        )
    }
    function close(restore = true) {
        if (!opened) return
        opened = false
        if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open'))
            panel.hidePopover()
        if (restore && focusTarget?.isConnected) focusTarget.focus()
    }
    async function toggle(event: Event) {
        const button = trigger?.querySelector('button')
        if (!button || button.matches(':disabled')) return
        event.preventDefault()
        event.stopPropagation()
        if (opened) {
            close()
            return
        }
        focusTarget = button
        opened = true
        await tick()
        if (!opened || !panel.isConnected) return
        if (typeof panel.showPopover === 'function') panel.showPopover()
        position()
        const first = panel.querySelector<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        )
        if (first) first.focus()
        else panel.focus()
    }
    function nativeToggle(event: Event) {
        // Native toggle events may arrive after Svelte has removed the panel.
        if ((event as ToggleEvent).newState !== 'closed' || !panel?.isConnected) return
        const active = (panel.getRootNode() as ShadowRoot).activeElement
        opened = false
        if (active && panel.contains(active)) focusTarget?.focus()
    }
    function keyboard(event: KeyboardEvent) {
        if (opened && event.key === 'Escape') {
            consumeEscape = true
            event.preventDefault()
            event.stopPropagation()
            close()
        }
    }
    function keyup(event: KeyboardEvent) {
        if (consumeEscape && event.key === 'Escape') {
            consumeEscape = false
            event.stopPropagation()
        }
    }
    $effect(() => {
        const target = container
        if (!target) return
        // Handle Escape before host modal listeners, including the keyup after focus returns.
        target.addEventListener('keydown', keyboard)
        target.addEventListener('keyup', keyup)
        return () => {
            target.removeEventListener('keydown', keyboard)
            target.removeEventListener('keyup', keyup)
        }
    })
    $effect(() => {
        const target = trigger
        if (!target) return
        const button = target.querySelector('button')
        button?.setAttribute('aria-haspopup', 'dialog')
        button?.setAttribute('aria-controls', `${prefix}-${node.id}-popover`)
        button?.setAttribute('aria-expanded', String(opened))
        target.addEventListener('click', toggle, { capture: true })
        return () => target.removeEventListener('click', toggle, { capture: true })
    })
    onMount(() => {
        function outside(event: PointerEvent) {
            if (!opened || typeof panel.showPopover === 'function') return
            if (!event.composedPath().includes(panel) && !event.composedPath().includes(trigger!))
                close(false)
        }
        window.addEventListener('resize', position)
        window.addEventListener('scroll', position, true)
        document.addEventListener('pointerdown', outside)
        return () => {
            window.removeEventListener('resize', position)
            window.removeEventListener('scroll', position, true)
            document.removeEventListener('pointerdown', outside)
        }
    })
    onDestroy(() => close(false))
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    bind:this={container}
    class="lg-popover"
    role="group"
>
    <div class="lg-popover-trigger" bind:this={trigger}><NodeRenderer id={node.trigger!} /></div>
    <div
        bind:this={panel}
        id={`${prefix}-${node.id}-popover`}
        class="lg-popover-panel"
        popover="auto"
        hidden={!opened}
        role="dialog"
        aria-modal="false"
        aria-labelledby={`${prefix}-${node.id}-title`}
        tabindex="-1"
        style:left={`${left}px`}
        style:top={`${top}px`}
        ontoggle={nativeToggle}
    >
        <header class="lg-popover-heading">
            <h3 class="lg-h3" id={`${prefix}-${node.id}-title`}>{label}</h3>
            <button
                type="button"
                class="lg-button lg-button-text"
                aria-label="关闭浮层"
                onclick={() => close()}>关闭</button
            >
        </header>
        <div class="lg-popover-content"><NodeRenderer id={node.content!} /></div>
    </div>
</div>
