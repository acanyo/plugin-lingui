<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, JsonValue } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let input: HTMLInputElement | HTMLTextAreaElement | undefined = $state()
    let revealed = $state(false)
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
    let multiline = $derived(node.variant === 'longText')
    let password = $derived(
        node.variant === 'obscured' || node.component === 'LingUI.PasswordInput',
    )
    let numeric = $derived(node.component === 'LingUI.NumberInput')
    let search = $derived(node.component === 'LingUI.SearchInput')
    let text = $derived(String(value ?? ''))
    let id = $derived(`${prefix}-${node.id}`)
    function set(value: JsonValue) {
        if (disabled || node.readOnly) return
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (cause) {
            report(cause)
        }
    }
    function change(event: Event) {
        const field = event.currentTarget as HTMLInputElement
        if (numeric) {
            if (!field.value.trim() || !Number.isFinite(field.valueAsNumber)) return
            const next = Math.max(
                Number(node.min ?? -1e12),
                Math.min(Number(node.max ?? 1e12), field.valueAsNumber),
            )
            field.value = String(next)
            set(next)
        } else set(field.value)
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
    <label for={id}>{label}</label>
    <div
        class="lg-input-shell"
        class:lg-input-multiline={multiline}
        class:lg-disabled={disabled}
        class:lg-readonly={node.readOnly}
    >
        {#if search}<LinguiIcon name="search" />{/if}
        {#if node.prefixText}<span class="lg-input-affix">{node.prefixText}</span>{/if}
        {#if multiline}<textarea
                bind:this={input}
                {id}
                rows="4"
                value={text}
                {disabled}
                readonly={node.readOnly}
                placeholder={node.placeholder}
                maxlength={node.maxLength ?? 2000}
                minlength={node.minLength}
                required={node.required}
                aria-invalid={node.status === 'error'}
                aria-describedby={node.hint || node.showCount ? `${id}-hint` : undefined}
                oninput={change}
            ></textarea>
        {:else}<input
                bind:this={input}
                {id}
                type={numeric || node.variant === 'number'
                    ? 'number'
                    : password && !revealed
                      ? 'password'
                      : search
                        ? 'search'
                        : 'text'}
                value={text}
                {disabled}
                readonly={node.readOnly}
                placeholder={node.placeholder ?? (search ? '搜索内容' : undefined)}
                min={node.min}
                max={node.max}
                step={node.step ?? 1}
                maxlength={node.maxLength ?? 2000}
                minlength={node.minLength}
                required={node.required}
                autocomplete={password ? 'off' : undefined}
                spellcheck={password ? false : undefined}
                aria-invalid={node.status === 'error'}
                aria-describedby={node.hint || node.showCount ? `${id}-hint` : undefined}
                oninput={change}
            />{/if}
        {#if node.clearable !== false && !numeric && text && !disabled && !node.readOnly}<button
                type="button"
                class="lg-input-clear"
                aria-label="清空输入"
                data-lingui-clear
                onclick={() => {
                    set('')
                    input?.focus()
                }}><LinguiIcon name="close" /></button
            >{/if}
        {#if password}<button
                type="button"
                class="lg-input-clear"
                {disabled}
                aria-label={revealed ? '隐藏密码' : '显示密码'}
                aria-pressed={revealed}
                onclick={() => {
                    revealed = !revealed
                    input?.focus()
                }}><LinguiIcon name={revealed ? 'eyeOff' : 'eye'} /></button
            >{/if}
        {#if node.suffixText}<span class="lg-input-affix">{node.suffixText}</span>{/if}
    </div>
    {#if node.hint || node.showCount}<div class="lg-field-meta" id={`${id}-hint`}>
            <span class="lg-caption">{node.hint ?? ''}</span>
            {#if node.showCount}<span class="lg-caption lg-input-count"
                    >{text.length} / {node.maxLength ?? 2000}</span
                >{/if}
        </div>{/if}
</div>
