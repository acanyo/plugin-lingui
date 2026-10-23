<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import { tick } from 'svelte'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { stringList } from '../inputs/values'
    import FloatingPanel from '../controls/FloatingPanel.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let container: HTMLDivElement | undefined = $state(),
        trigger: HTMLButtonElement | undefined = $state()
    let panel: HTMLDivElement | undefined = $state(),
        searchInput: HTMLInputElement | undefined = $state()
    let opened = $state(false),
        query = $state(''),
        active = $state(0)
    let multiple = $derived(node.component === 'LingUI.MultiSelect')
    let value = $derived.by(() => {
        $snapshot
        return resolve(node.value)
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let selected = $derived(
        multiple
            ? stringList(value, node.maxSelected ?? 40, 160)
            : typeof value === 'string' && value
              ? [value]
              : [],
    )
    let options = $derived(
        (node.options ?? []).filter((option) =>
            `${option.label} ${option.description ?? ''} ${option.group ?? ''}`
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
        ),
    )
    let selectedOptions = $derived(
        (node.options ?? []).filter((option) => selected.includes(option.value)),
    )
    let panelId = $derived(`${prefix}-${node.id}-listbox`),
        labelId = $derived(`${prefix}-${node.id}-label`)
    function unavailable(index: number) {
        const option = options[index]
        return (
            !option ||
            !!option.disabled ||
            (multiple &&
                selected.length >= (node.maxSelected ?? 40) &&
                !selected.includes(option.value))
        )
    }
    function set(values: string[]) {
        if (disabled || node.readOnly) return
        try {
            nodeEvents.set(node.value as Binding, multiple ? values : (values[0] ?? ''))
        } catch (cause) {
            report(cause)
        }
    }
    function close() {
        opened = false
        trigger?.focus({ preventScroll: true })
    }
    function choose(index: number) {
        if (unavailable(index)) return
        const option = options[index]!
        set(
            multiple && selected.includes(option.value)
                ? selected.filter((item) => item !== option.value)
                : multiple
                  ? [...selected, option.value]
                  : [option.value],
        )
        if (!multiple) close()
    }
    async function open() {
        if (disabled || node.readOnly) return
        query = ''
        active = Math.max(
            0,
            options.findIndex((option) => selected.includes(option.value) && !option.disabled),
        )
        opened = true
    }
    function move(step: number, endpoint?: number) {
        const start = endpoint ?? active + step
        for (let index = start; index >= 0 && index < options.length; index += step)
            if (!unavailable(index)) {
                active = index
                break
            }
        void tick().then(() => {
            const item = panel?.querySelector<HTMLElement>(`[id="${panelId}-${active}"]`)
            if (item && panel) {
                if (item.offsetTop < panel.scrollTop) panel.scrollTop = item.offsetTop
                else if (item.offsetTop + item.offsetHeight > panel.scrollTop + panel.clientHeight)
                    panel.scrollTop = item.offsetTop + item.offsetHeight - panel.clientHeight
            }
        })
    }
    function keyboard(event: KeyboardEvent) {
        if (disabled || node.readOnly || event.isComposing) return
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault()
            if (!opened) void open()
            else move(event.key === 'ArrowDown' ? 1 : -1)
        } else if (
            event.key === 'Enter' ||
            (event.key === ' ' && event.currentTarget === trigger)
        ) {
            event.preventDefault()
            if (!opened) void open()
            else choose(active)
        } else if (
            opened &&
            ['Home', 'End'].includes(event.key) &&
            event.currentTarget !== searchInput
        ) {
            event.preventDefault()
            move(event.key === 'Home' ? 1 : -1, event.key === 'Home' ? 0 : options.length - 1)
        }
    }
    $effect(() => {
        query
        active = Math.max(
            0,
            options.findIndex((option) => !option.disabled),
        )
    })
    $effect(() => {
        if (disabled || node.readOnly) opened = false
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    bind:this={container}
    class={`lg-field lg-size-${node.size ?? 'medium'} lg-field-status-${node.status ?? 'default'}`}
>
    <label id={labelId} for={`${prefix}-${node.id}`}>{label}</label>
    <div class="lg-selection-control" class:lg-disabled={disabled}>
        {#if multiple && selectedOptions.length}<div class="lg-selected-tags">
                {#each selectedOptions.slice(0, node.maxVisible ?? 2) as option (option.value)}
                    <span class="lg-input-tag"
                        ><span title={option.label}>{option.label}</span><button
                            type="button"
                            disabled={disabled || node.readOnly}
                            aria-label={`移除 ${option.label}`}
                            onclick={() => {
                                set(selected.filter((item) => item !== option.value))
                                trigger?.focus()
                            }}><LinguiIcon name="close" /></button
                        ></span
                    >
                {/each}
            </div>{/if}
        <button
            bind:this={trigger}
            id={`${prefix}-${node.id}`}
            type="button"
            role="combobox"
            class="lg-select-trigger"
            class:lg-select-placeholder={!selectedOptions.length}
            {disabled}
            aria-readonly={node.readOnly || undefined}
            aria-labelledby={labelId}
            aria-describedby={node.hint ? `${labelId}-hint` : undefined}
            aria-invalid={node.status === 'error'}
            aria-haspopup="listbox"
            aria-expanded={opened}
            aria-controls={panelId}
            aria-activedescendant={opened && options.length ? `${panelId}-${active}` : undefined}
            onclick={() => (opened ? close() : void open())}
            onkeydown={keyboard}
        >
            <span class="lg-select-value"
                >{multiple
                    ? selectedOptions.length > (node.maxVisible ?? 2)
                        ? `+${selectedOptions.length - (node.maxVisible ?? 2)}`
                        : selectedOptions.length
                          ? ''
                          : node.placeholder || '请选择，可多选'
                    : selectedOptions[0]?.label || node.placeholder || '搜索并选择'}</span
            >
            <span class="lg-select-chevron"><LinguiIcon name="chevronDown" /></span>
        </button>
    </div>
    <FloatingPanel
        bind:open={opened}
        bind:panel
        anchor={trigger}
        {container}
        id={`${panelId}-panel`}
        labelledby={labelId}
        onopened={() => searchInput?.focus({ preventScroll: true })}
    >
        <div class="lg-selection-search">
            <input
                bind:this={searchInput}
                type="search"
                bind:value={query}
                placeholder="搜索选项"
                aria-label={`搜索${label}`}
                role="combobox"
                aria-expanded={opened}
                aria-controls={panelId}
                aria-autocomplete="list"
                aria-activedescendant={options.length ? `${panelId}-${active}` : undefined}
                onkeydown={keyboard}
            />
        </div>
        <div
            id={panelId}
            role="listbox"
            aria-labelledby={labelId}
            aria-multiselectable={multiple || undefined}
        >
            {#each options as option, index (option.value)}
                {#if option.group && (index === 0 || options[index - 1]?.group !== option.group)}<div
                        class="lg-option-group"
                    >
                        {option.group}
                    </div>{/if}
                <button
                    type="button"
                    role="option"
                    id={`${panelId}-${index}`}
                    class="lg-select-option"
                    class:lg-select-option-active={active === index}
                    aria-selected={selected.includes(option.value)}
                    disabled={unavailable(index)}
                    tabindex="-1"
                    onpointerdown={(event) => event.preventDefault()}
                    onclick={() => choose(index)}
                >
                    <span class="lg-option-copy"
                        ><span>{option.label}</span>{#if option.description}<small
                                >{option.description}</small
                            >{/if}</span
                    >
                    <span class="lg-select-check"
                        >{#if selected.includes(option.value)}<LinguiIcon name="check" />{/if}</span
                    >
                </button>
            {/each}
            {#if !options.length}<p class="lg-option-empty" role="status">没有匹配的选项</p>{/if}
        </div>
        {#if node.clearable !== false}<div class="lg-panel-footer">
                <span class="lg-caption"
                    >{multiple ? `已选 ${selected.length} / ${node.maxSelected ?? 40}` : ''}</span
                >
                <button
                    class="lg-button lg-button-text lg-size-small"
                    data-lingui-clear
                    type="button"
                    disabled={!selected.length}
                    onclick={() => {
                        set([])
                        if (!multiple) close()
                    }}>清空选择</button
                >
            </div>{/if}
    </FloatingPanel>
    {#if node.hint}<p class="lg-caption" id={`${labelId}-hint`}>{node.hint}</p>{/if}
</div>
