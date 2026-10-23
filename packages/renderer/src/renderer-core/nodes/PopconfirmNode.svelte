<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useNodeEvents } from '../../events/node'
    import { useGroupDisabled } from '../inputs/group-state'
    import FloatingPanel from '../controls/FloatingPanel.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix, busy } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let container: HTMLDivElement | undefined = $state(),
        trigger: HTMLButtonElement | undefined = $state(),
        panel: HTMLDivElement | undefined = $state()
    let opened = $state(false)
    let wasOpened = false
    $effect(() => {
        if (wasOpened === opened) return
        wasOpened = opened
        nodeEvents.emit(opened ? 'open' : 'close', { open: opened })
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled)) || $busy.has(node.id)
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let text = $derived.by(() => {
        $snapshot
        return String(resolve(node.text) ?? '')
    })
    let id = $derived(`${prefix}-${node.id}-confirm`)
    function close() {
        opened = false
        trigger?.focus({ preventScroll: true })
    }
    function open() {
        if (!disabled) opened = true
    }
    function confirm() {
        if (disabled) return
        try {
            if (node.action) runtime.dispatch(node.action)
            nodeEvents.emit('confirm', { confirmed: true })
            close()
        } catch (cause) {
            report(cause)
        }
    }
    $effect(() => {
        if (disabled) opened = false
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-menu-control"
    bind:this={container}
>
    <button
        bind:this={trigger}
        type="button"
        class={`lg-button lg-button-secondary lg-size-${node.size ?? 'medium'}`}
        {disabled}
        aria-haspopup="dialog"
        aria-expanded={opened}
        aria-controls={id}
        onclick={() => (opened ? close() : void open())}>{label}</button
    >
    <FloatingPanel
        bind:open={opened}
        bind:panel
        anchor={trigger}
        {container}
        {id}
        role="dialog"
        labelledby={`${id}-text`}
        width={300}
        className="lg-confirm-panel"
        onopened={(target) =>
            target
                .querySelector<HTMLButtonElement>('[data-cancel]')
                ?.focus({ preventScroll: true })}
    >
        <div class={`lg-confirm-copy lg-tone-${node.tone ?? 'warning'}`}>
            <LinguiIcon name={node.tone === 'info' ? 'info' : 'warning'} />
            <p id={`${id}-text`}>{text}</p>
        </div>
        <div class="lg-confirm-actions">
            <button
                data-cancel
                type="button"
                class="lg-button lg-button-secondary lg-size-small"
                onclick={() => {
                    nodeEvents.emit('cancel', { confirmed: false })
                    close()
                }}>{node.cancelText || '取消'}</button
            >
            <button
                type="button"
                class={`lg-button lg-button-primary lg-size-small lg-button-tone-${node.tone === 'danger' ? 'danger' : 'info'}`}
                onclick={confirm}>{node.confirmText || '确认'}</button
            >
        </div>
    </FloatingPanel>
</div>
