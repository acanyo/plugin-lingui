<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import { onMount, onDestroy, tick } from 'svelte'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { positionFloatingPanel } from '../inputs/floating'
    import LinguiIcon from '../LinguiIcon.svelte'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { bindEscapeScope } from '../inputs/escape-scope'

    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve, prefix, report } = useRenderer()
    let container = $state<HTMLDivElement>()
    let trigger = $state<HTMLButtonElement>()
    let panel = $state<HTMLDivElement>()
    let opened = $state(false)
    let activeIndex = $state(0)
    let search = ''
    let searchTime = 0
    let value = $derived.by(() => {
        $snapshot
        return resolve(node.value)
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let options = $derived([
        ...(node.clearable === false
            ? []
            : [
                  {
                      label: node.placeholder || '请选择',
                      value: '',
                      disabled: false,
                      group: '',
                      description: '',
                  },
              ]),
        ...(node.options ?? []),
    ])
    let selectedIndex = $derived(
        Math.max(
            0,
            options.findIndex((option) => option.value === value),
        ),
    )
    let labelId = $derived(`${prefix}-${node.id}-label`)
    let panelId = $derived(`${prefix}-${node.id}-listbox`)

    function position() {
        if (!opened || !trigger || !panel) return
        positionFloatingPanel(trigger, panel)
    }
    function close(restoreFocus = true) {
        if (!opened) return
        opened = false
        search = ''
        if (panel?.isConnected && typeof panel.hidePopover === 'function') panel.hidePopover()
        if (restoreFocus && trigger?.isConnected) trigger.focus({ preventScroll: true })
    }
    async function open(index = selectedIndex) {
        if (disabled || node.readOnly) return
        activeIndex = Math.max(0, Math.min(options.length - 1, index))
        if (options[activeIndex]?.disabled)
            activeIndex = Math.max(
                0,
                options.findIndex((option) => !option.disabled),
            )
        opened = true
        await tick()
        if (!opened || !panel?.isConnected) return
        // Keep the menu in this shadow tree for theme inheritance, above clipping containers.
        // Manual mode lets our Escape scope close only this menu inside a preview dialog.
        if (typeof panel.showPopover === 'function') panel.showPopover()
        position()
        revealActive()
    }
    function revealActive() {
        const option = panel?.querySelector<HTMLElement>(`[id="${panelId}-${activeIndex}"]`)
        if (!option || !panel) return
        // Scroll only the menu; scrollIntoView could move the surrounding workbench.
        if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop
        else if (option.offsetTop + option.offsetHeight > panel.scrollTop + panel.clientHeight)
            panel.scrollTop = option.offsetTop + option.offsetHeight - panel.clientHeight
    }
    function choose(index: number) {
        if (disabled || node.readOnly || !options[index] || options[index]!.disabled) return
        try {
            nodeEvents.set(node.value as Binding, options[index]!.value)
            if (options[index]!.value === '') nodeEvents.emit('clear', { value: '' })
            close()
        } catch (error) {
            report(error)
        }
    }
    function keyboard(event: KeyboardEvent) {
        if (disabled || node.readOnly || event.isComposing) return
        if (Date.now() - searchTime > 700) search = ''
        if (event.key === 'Tab') {
            close(false)
            return
        }
        if (event.key === 'ArrowUp' && event.altKey && opened) {
            event.preventDefault()
            close()
            return
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            search = ''
            const endpoint = event.key === 'Home' ? 0 : options.length - 1
            if (!opened) void open(['Home', 'End'].includes(event.key) ? endpoint : selectedIndex)
            else {
                const step = event.key === 'ArrowDown' || event.key === 'Home' ? 1 : -1
                for (
                    let i = ['Home', 'End'].includes(event.key) ? endpoint : activeIndex + step;
                    i >= 0 && i < options.length;
                    i += step
                )
                    if (!options[i]!.disabled) {
                        activeIndex = i
                        break
                    }
                void tick().then(revealActive)
            }
        } else if (event.key === 'Enter' || (event.key === ' ' && !search)) {
            event.preventDefault()
            if (opened) choose(activeIndex)
            else void open()
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault()
            const now = Date.now()
            search = (now - searchTime > 700 ? '' : search) + event.key.toLocaleLowerCase()
            searchTime = now
            const repeated = [...search].every((character) => character === search[0])
            const query = repeated ? search[0]! : search
            const current = opened ? activeIndex : selectedIndex
            const start = repeated ? current + 1 : current
            const index = options.findIndex(
                (_, offset) =>
                    !options[(start + offset) % options.length]!.disabled &&
                    options[
                        (start + offset) % options.length
                    ]!.label.toLocaleLowerCase().startsWith(query),
            )
            if (index !== -1) {
                const next = (start + index) % options.length
                if (!opened) void open(next)
                else {
                    activeIndex = next
                    void tick().then(revealActive)
                }
            }
        }
    }
    $effect(() => {
        if (container)
            return bindEscapeScope(
                container,
                () => opened,
                () => close(),
            )
    })
    $effect(() => {
        if (opened && (disabled || node.readOnly)) close(false)
    })
    $effect(() => {
        // Reconcile options updated by the manual editor while the menu is open.
        const count = options.length
        if (opened && activeIndex >= count) activeIndex = count - 1
    })
    $effect(() => {
        if (!opened || !trigger || !panel) return
        const observer =
            typeof ResizeObserver === 'function' ? new ResizeObserver(position) : undefined
        observer?.observe(trigger)
        observer?.observe(panel)
        window.addEventListener('resize', position)
        window.addEventListener('scroll', position, true)
        window.visualViewport?.addEventListener('resize', position)
        window.visualViewport?.addEventListener('scroll', position)
        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', position)
            window.removeEventListener('scroll', position, true)
            window.visualViewport?.removeEventListener('resize', position)
            window.visualViewport?.removeEventListener('scroll', position)
        }
    })
    onMount(() => {
        function outside(event: Event) {
            if (opened && container && !event.composedPath().includes(container)) close(false)
        }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('focusin', outside)
        return () => {
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('focusin', outside)
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
    class={`lg-field lg-select-field lg-size-${node.size ?? 'medium'} lg-field-status-${node.status ?? 'default'}`}
    bind:this={container}
>
    <label id={labelId} for={`${prefix}-${node.id}-select`}>{label}</label>
    <button
        bind:this={trigger}
        id={`${prefix}-${node.id}-select`}
        type="button"
        role="combobox"
        class="lg-select-trigger"
        class:lg-select-placeholder={!value}
        {disabled}
        aria-invalid={node.status === 'error'}
        aria-describedby={node.hint ? `${labelId}-hint` : undefined}
        aria-readonly={node.readOnly || undefined}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={opened}
        aria-controls={panelId}
        aria-activedescendant={opened ? `${panelId}-${activeIndex}` : undefined}
        onclick={() => (opened ? close() : void open())}
        onkeydown={keyboard}
    >
        <span class="lg-select-value" title={options[selectedIndex]?.label}
            >{value
                ? (options.find((option) => option.value === value)?.label ??
                  node.placeholder ??
                  '请选择')
                : (node.placeholder ?? '请选择')}</span
        >
        <span class="lg-select-chevron"><LinguiIcon name="chevronDown" /></span>
    </button>
    <div
        bind:this={panel}
        id={panelId}
        class="lg-select-panel"
        popover="manual"
        role="listbox"
        aria-labelledby={labelId}
        hidden={!opened}
        ontoggle={(event) => {
            if ((event as ToggleEvent).newState === 'closed' && panel?.isConnected) {
                opened = false
                search = ''
            }
        }}
    >
        {#each options as option, index (option.value)}
            {#if option.group && (index === 0 || options[index - 1]?.group !== option.group)}<div
                    class="lg-option-group"
                >
                    {option.group}
                </div>{/if}
            <button
                disabled={option.disabled}
                id={`${panelId}-${index}`}
                type="button"
                role="option"
                class="lg-select-option"
                class:lg-select-option-active={index === activeIndex}
                class:lg-select-option-empty={option.value === ''}
                aria-selected={option.value === value || (option.value === '' && !value)}
                tabindex="-1"
                onpointerdown={(event) => event.preventDefault()}
                onclick={() => choose(index)}
                onkeydown={keyboard}
            >
                <span class="lg-option-copy"
                    ><span>{option.label}</span>{#if option.description}<small
                            >{option.description}</small
                        >{/if}</span
                >
                <span class="lg-select-check"
                    >{#if option.value === value || (option.value === '' && !value)}<LinguiIcon
                            name="check"
                        />{/if}</span
                >
            </button>
        {/each}
    </div>
    {#if node.hint}<p class="lg-caption" id={`${labelId}-hint`}>{node.hint}</p>{/if}
</div>
