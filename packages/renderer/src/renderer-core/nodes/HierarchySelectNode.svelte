<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import { tick } from 'svelte'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { ancestry, treeDisabled, visibleTree, type TreeItem } from '../inputs/hierarchy'
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
        query = $state(''),
        expanded = $state<string[]>([]),
        trail = $state<string[]>([])
    let value = $derived.by(() => {
        $snapshot
        return String(resolve(node.value) ?? '')
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let cascader = $derived(node.component === 'LingUI.Cascader'),
        items = $derived(node.treeItems ?? [])
    let id = $derived(`${prefix}-${node.id}-hierarchy`),
        selected = $derived(ancestry(items, value))
    let visible = $derived(visibleTree(items, expanded, query))
    let columns = $derived(
        [
            items.filter((item) => !item.parent),
            ...trail.map((parent) => items.filter((item) => item.parent === parent)),
        ].filter((column) => column.length),
    )
    function hasChildren(item: TreeItem) {
        return items.some((child) => child.parent === item.id)
    }
    function choose(item: TreeItem) {
        if (disabled || node.readOnly || treeDisabled(items, item)) return
        try {
            nodeEvents.set(node.value as Binding, item.id)
            close()
        } catch (cause) {
            report(cause)
        }
    }
    function close() {
        opened = false
        trigger?.focus({ preventScroll: true })
    }
    async function focus(id: string | undefined) {
        await tick()
        if (id)
            container
                ?.querySelector<HTMLButtonElement>(`[data-tree-id="${id}"]`)
                ?.focus({ preventScroll: true })
    }
    async function open() {
        if (disabled || node.readOnly) return
        query = ''
        expanded = [
            ...new Set([
                ...items.filter((item) => !item.parent).map((item) => item.id),
                ...selected.map((item) => item.id),
            ]),
        ]
        trail = selected.filter(hasChildren).map((item) => item.id)
        opened = true
    }
    async function descend(item: TreeItem, level: number) {
        if (treeDisabled(items, item)) return
        trail = [...trail.slice(0, level), item.id]
        await tick()
        const columns = container?.querySelector<HTMLElement>('.lg-cascader-columns')
        if (columns) columns.scrollLeft = columns.scrollWidth - columns.clientWidth
    }
    function toggle(item: TreeItem) {
        expanded = expanded.includes(item.id)
            ? expanded.filter((id) => id !== item.id)
            : [...expanded, item.id]
    }
    function keyboard(event: KeyboardEvent, item: TreeItem, level: number) {
        if (event.isComposing) return
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const list = cascader ? (columns[level] ?? []) : visible.map((entry) => entry.item)
            const enabled = list.filter((entry) => !treeDisabled(items, entry)),
                current = enabled.findIndex((entry) => entry.id === item.id)
            const next =
                event.key === 'Home'
                    ? enabled[0]
                    : event.key === 'End'
                      ? enabled.at(-1)
                      : enabled[
                            Math.max(
                                0,
                                Math.min(
                                    enabled.length - 1,
                                    current + (event.key === 'ArrowDown' ? 1 : -1),
                                ),
                            )
                        ]
            void focus(next?.id)
        } else if (event.key === 'ArrowRight' && hasChildren(item)) {
            event.preventDefault()
            if (cascader) descend(item, level)
            else if (!expanded.includes(item.id)) toggle(item)
            void focus(
                items.find((child) => child.parent === item.id && !treeDisabled(items, child))?.id,
            )
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault()
            if (!cascader && expanded.includes(item.id)) toggle(item)
            else {
                if (cascader) trail = trail.slice(0, Math.max(0, level - 1))
                void focus(item.parent)
            }
        }
    }
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
    <label for={`${id}-trigger`} id={`${id}-label`}>{label}</label>
    <button
        bind:this={trigger}
        id={`${id}-trigger`}
        type="button"
        class="lg-select-trigger"
        role="combobox"
        {disabled}
        class:lg-select-placeholder={!selected.length}
        aria-readonly={node.readOnly || undefined}
        aria-haspopup={cascader ? 'dialog' : 'tree'}
        aria-expanded={opened}
        aria-controls={id}
        aria-labelledby={`${id}-label`}
        aria-invalid={node.status === 'error'}
        onclick={() => (opened ? close() : void open())}
        onkeydown={(event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                void open()
            }
        }}
    >
        <span class="lg-select-value"
            >{selected.length
                ? selected.map((item) => item.label).join(' / ')
                : node.placeholder || '请选择'}</span
        >
        <span class="lg-select-chevron"><LinguiIcon name="chevronDown" /></span>
    </button>
    <FloatingPanel
        bind:open={opened}
        bind:panel
        anchor={trigger}
        {container}
        {id}
        role={cascader ? 'dialog' : 'tree'}
        labelledby={`${id}-label`}
        width={cascader ? 520 : undefined}
        onopened={() => void focus(value || items.find((item) => !treeDisabled(items, item))?.id)}
    >
        {#if cascader}<div class="lg-cascader-columns">
                {#each columns as column, level}<div
                        class="lg-cascader-column"
                        role="group"
                        aria-label={`第 ${level + 1} 级`}
                    >
                        {#each column as item (item.id)}<button
                                type="button"
                                data-tree-id={item.id}
                                class="lg-select-option"
                                aria-pressed={trail.includes(item.id) || value === item.id}
                                disabled={treeDisabled(items, item)}
                                onclick={() =>
                                    hasChildren(item) ? descend(item, level) : choose(item)}
                                onkeydown={(event) => keyboard(event, item, level)}
                            >
                                <span>{item.label}</span><span class="lg-select-check"
                                    >{#if hasChildren(item)}<span class="lg-chevron-right"
                                            ><LinguiIcon name="chevronDown" /></span
                                        >{:else if value === item.id}<LinguiIcon
                                            name="check"
                                        />{/if}</span
                                >
                            </button>{/each}
                    </div>{/each}
            </div>{:else}
            <div class="lg-selection-search" role="presentation">
                <input
                    type="search"
                    placeholder="搜索节点"
                    aria-label={`搜索${label}`}
                    bind:value={query}
                />
            </div>
            {#each visible as entry (entry.item.id)}
                <div
                    class="lg-tree-select-row"
                    role="presentation"
                    style:--lg-tree-level={entry.level - 1}
                >
                    {#if hasChildren(entry.item)}<button
                            type="button"
                            class="lg-tree-expand"
                            aria-label={`${expanded.includes(entry.item.id) ? '收起' : '展开'} ${entry.item.label}`}
                            disabled={treeDisabled(items, entry.item)}
                            onclick={() => toggle(entry.item)}
                            ><span
                                class:lg-chevron-open={expanded.includes(entry.item.id)}
                                class="lg-chevron-right"><LinguiIcon name="chevronDown" /></span
                            ></button
                        >{:else}<span class="lg-tree-spacer"></span>{/if}
                    <button
                        type="button"
                        role="treeitem"
                        data-tree-id={entry.item.id}
                        class="lg-select-option"
                        aria-level={entry.level}
                        aria-expanded={hasChildren(entry.item)
                            ? query
                                ? true
                                : expanded.includes(entry.item.id)
                            : undefined}
                        aria-selected={value === entry.item.id}
                        disabled={treeDisabled(items, entry.item)}
                        onclick={() => choose(entry.item)}
                        onkeydown={(event) => keyboard(event, entry.item, entry.level - 1)}
                    >
                        <span>{entry.item.label}</span><span class="lg-select-check"
                            >{#if value === entry.item.id}<LinguiIcon name="check" />{/if}</span
                        >
                    </button>
                </div>
            {/each}
            {#if !visible.length}<p role="status" class="lg-option-empty">没有匹配的节点</p>{/if}
        {/if}
        {#if node.clearable !== false}<div class="lg-panel-footer">
                <button
                    type="button"
                    class="lg-button lg-button-text lg-size-small"
                    data-lingui-clear
                    disabled={!value}
                    onclick={() => {
                        if (!disabled && !node.readOnly) {
                            try {
                                nodeEvents.set(node.value as Binding, '')
                                close()
                            } catch (cause) {
                                report(cause)
                            }
                        }
                    }}>清空选择</button
                >
            </div>{/if}
    </FloatingPanel>
    {#if node.hint}<p class="lg-caption">{node.hint}</p>{/if}
</div>
