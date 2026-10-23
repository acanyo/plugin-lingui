<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { stringList } from '../inputs/values'
    import LinguiIcon from '../LinguiIcon.svelte'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve: resolveValue, prefix, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    let limit = $derived(node.maxTags ?? 10)
    let selected = $derived(stringList(resolve(node.value), limit, 80))
    let draft = $state(''),
        error = $state('')
    let tagInput: HTMLInputElement | undefined = $state()
    function set(value: string[]) {
        if (disabled || node.readOnly) return
        try {
            nodeEvents.set(node.value as Binding, value)
            error = ''
        } catch (cause) {
            report(cause)
        }
    }
    function add() {
        if (disabled || node.readOnly) return
        const tag = draft.trim()
        if (!tag) return
        if (tag.length > 80) {
            error = '每个标签最多 80 个字符。'
            return
        }
        if (selected.includes(tag)) {
            error = '这个标签已经添加过了。'
            return
        }
        if (selected.length >= limit) {
            error = `最多添加 ${limit} 个标签。`
            return
        }
        set([...selected, tag])
        nodeEvents.emit('add', { value: tag, index: selected.length })
        draft = ''
        tagInput?.focus()
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class={`lg-field lg-size-${node.size ?? 'medium'} lg-field-status-${node.status ?? 'default'}`}
>
    <label for={`${prefix}-${node.id}`}>{resolve(node.label)}</label>
    <div class="lg-tag-input" class:lg-disabled={disabled || node.readOnly}>
        {#each selected as tag (tag)}<span class="lg-input-tag"
                ><span>{tag}</span><button
                    type="button"
                    disabled={disabled || node.readOnly}
                    aria-label={`移除标签 ${tag}`}
                    onclick={() => {
                        set(selected.filter((item) => item !== tag))
                        nodeEvents.emit('remove', { value: tag })
                        tagInput?.focus()
                    }}><LinguiIcon name="close" /></button
                ></span
            >{/each}
        <div class="lg-tag-entry">
            <input
                id={`${prefix}-${node.id}`}
                bind:this={tagInput}
                type="text"
                bind:value={draft}
                disabled={disabled || node.readOnly}
                maxlength="81"
                readonly={node.readOnly}
                placeholder={node.placeholder || '输入后按回车'}
                aria-describedby={`${prefix}-${node.id}-hint`}
                aria-invalid={!!error}
                onkeydown={(event) => {
                    if (event.isComposing) return
                    if (event.key === 'Enter') {
                        event.preventDefault()
                        add()
                    }
                    if (event.key === 'Backspace' && !draft && selected.length)
                        set(selected.slice(0, -1))
                }}
            />
            <button
                type="button"
                class="lg-tag-add"
                disabled={disabled || node.readOnly || !draft.trim() || selected.length >= limit}
                onclick={add}>添加</button
            >
        </div>
    </div>
    <p
        id={`${prefix}-${node.id}-hint`}
        class="lg-caption"
        class:lg-input-error={!!error}
        aria-live="polite"
    >
        {error || `已添加 ${selected.length} / ${limit} 个标签 · 回车添加`}
    </p>
</div>
