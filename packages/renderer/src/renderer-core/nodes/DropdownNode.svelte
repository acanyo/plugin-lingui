<script lang="ts">
    import { tick } from 'svelte'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useNodeEvents } from '../../events/node'
    import { useGroupDisabled } from '../inputs/group-state'
    import FloatingPanel from '../controls/FloatingPanel.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let container: HTMLDivElement | undefined = $state(),
        trigger: HTMLButtonElement | undefined = $state(),
        panel: HTMLDivElement | undefined = $state()
    let opened = $state(false),
        active = $state(0)
    let wasOpened = false
    $effect(() => {
        if (wasOpened === opened) return
        wasOpened = opened
        nodeEvents.emit(opened ? 'open' : 'close', { open: opened })
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let items = $derived(node.menuItems ?? [])
    let id = $derived(`${prefix}-${node.id}-menu`)
    async function focus(index: number) {
        active = index
        await tick()
        container
            ?.querySelector<HTMLButtonElement>(`[data-menu-index="${index}"]`)
            ?.focus({ preventScroll: true })
    }
    async function open(last = false) {
        if (disabled) return
        opened = true
        const enabled = items
            .map((item, index) => (item.disabled ? -1 : index))
            .filter((index) => index >= 0)
        active = (last ? enabled.at(-1) : enabled[0]) ?? 0
    }
    function close(restore = true) {
        opened = false
        if (restore) trigger?.focus({ preventScroll: true })
    }
    function choose(index: number) {
        if (disabled || items[index]?.disabled) return
        try {
            const action = items[index]!.action
            if (action) runtime.dispatch(action)
            nodeEvents.emit('select', { id: items[index]!.id, label: items[index]!.label, index })
            close()
        } catch (cause) {
            report(cause)
        }
    }
    function keyboard(event: KeyboardEvent) {
        if (disabled) return
        if (event.key === 'Tab') {
            close(false)
            return
        }
        if (!opened && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            void open(event.key === 'ArrowUp')
            return
        }
        if (!opened) return
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const enabled = items
                .map((item, index) => (item.disabled ? -1 : index))
                .filter((index) => index >= 0)
            const current = enabled.indexOf(active),
                step = event.key === 'ArrowUp' ? -1 : 1
            const index =
                event.key === 'Home'
                    ? enabled[0]
                    : event.key === 'End'
                      ? enabled.at(-1)
                      : enabled[(current + step + enabled.length) % enabled.length]
            if (index !== undefined) void focus(index)
        }
    }
    $effect(() => {
        if (disabled) opened = false
    })
</script>

<div data-lingui-node={node.id} class="lg-menu-control" bind:this={container}>
    <button
        bind:this={trigger}
        type="button"
        class={`lg-button lg-button-secondary lg-size-${node.size ?? 'medium'}`}
        {disabled}
        aria-haspopup="menu"
        aria-expanded={opened}
        aria-controls={id}
        onclick={() => (opened ? close() : void open())}
        onkeydown={keyboard}
    >
        <span>{label}</span><span class="lg-select-chevron" class:lg-chevron-open={opened}
            ><LinguiIcon name="chevronDown" /></span
        >
    </button>
    <FloatingPanel
        bind:open={opened}
        bind:panel
        anchor={trigger}
        {container}
        {id}
        role="menu"
        width={240}
        onopened={() => void focus(active)}
    >
        {#each items as item, index (item.id)}
            {#if item.group && (index === 0 || items[index - 1]?.group !== item.group)}<div
                    class="lg-option-group"
                    role="presentation"
                >
                    {item.group}
                </div>{/if}
            <button
                type="button"
                role="menuitem"
                data-menu-index={index}
                class="lg-select-option"
                class:lg-menu-danger={item.tone === 'danger'}
                disabled={item.disabled}
                tabindex={active === index ? 0 : -1}
                onclick={() => choose(index)}
                onkeydown={keyboard}>{item.label}</button
            >
        {/each}
    </FloatingPanel>
</div>
