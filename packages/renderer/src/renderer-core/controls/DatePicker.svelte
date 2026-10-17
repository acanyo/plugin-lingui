<script lang="ts">
    import { dateInputValue } from '../../protocol/date-time'
    import FloatingPanel from './FloatingPanel.svelte'
    import CalendarPanel from './CalendarPanel.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let {
        id,
        nodeId,
        label,
        value,
        min = '',
        max = '',
        enableDate = true,
        enableTime = false,
        disabled = false,
        readOnly = false,
        placeholder,
        clearable = true,
        status = 'default',
        size = 'medium',
        hint,
        onvalue,
    }: {
        id: string
        nodeId?: string
        label: string
        value: string
        min?: string
        max?: string
        enableDate?: boolean
        enableTime?: boolean
        disabled?: boolean
        readOnly?: boolean
        placeholder?: string
        clearable?: boolean
        status?: string
        size?: string
        hint?: string
        onvalue: (value: string) => void
    } = $props()
    let container: HTMLDivElement | undefined = $state(),
        trigger: HTMLButtonElement | undefined = $state(),
        panel: HTMLDivElement | undefined = $state()
    let opened = $state(false),
        draftDate = $state(''),
        draftTime = $state(''),
        error = $state('')
    let candidate = $derived(
        enableDate && enableTime
            ? draftDate && draftTime
                ? `${draftDate}T${draftTime}`
                : ''
            : enableTime
              ? draftTime
              : draftDate,
    )
    let valid = $derived(
        !!dateInputValue(candidate, enableDate, enableTime) &&
            (!min || candidate >= min) &&
            (!max || candidate <= max),
    )
    function close() {
        opened = false
        trigger?.focus({ preventScroll: true })
    }
    async function open() {
        if (disabled || readOnly) return
        draftDate = enableDate ? value.slice(0, 10) : ''
        draftTime = enableTime ? (value ? (enableDate ? value.slice(11) : value) : '09:00') : ''
        error = ''
        opened = true
    }
    function commit(next = candidate) {
        if (disabled || readOnly) return
        if (
            next &&
            (!dateInputValue(next, enableDate, enableTime) ||
                (min && next < min) ||
                (max && next > max))
        ) {
            error = '请选择范围内的日期和时间'
            return
        }
        onvalue(next)
        close()
    }
    $effect(() => {
        if (disabled || readOnly) opened = false
    })
</script>

<div
    data-lingui-node={nodeId}
    bind:this={container}
    class={`lg-field lg-date-picker lg-size-${size} lg-field-status-${status}`}
>
    <label id={`${id}-label`} for={id}>{label}</label>
    <button
        bind:this={trigger}
        {id}
        type="button"
        role="combobox"
        class="lg-select-trigger"
        class:lg-select-placeholder={!value}
        {disabled}
        aria-readonly={readOnly || undefined}
        aria-haspopup="dialog"
        aria-expanded={opened}
        aria-controls={`${id}-panel`}
        aria-invalid={status === 'error'}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onclick={() => (opened ? close() : void open())}
        onkeydown={(event) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                void open()
            }
        }}
    >
        <span class="lg-select-value"
            >{value.replace('T', ' ') ||
                placeholder ||
                (enableDate ? '选择日期' : '选择时间')}</span
        >
        <span class="lg-date-icon"><LinguiIcon name={enableDate ? 'calendar' : 'clock'} /></span>
    </button>
    <FloatingPanel
        bind:open={opened}
        bind:panel
        anchor={trigger}
        {container}
        id={`${id}-panel`}
        role="dialog"
        labelledby={`${id}-label`}
        width={300}
        className="lg-date-panel"
        onopened={(target) =>
            target
                .querySelector<HTMLElement>('[tabindex="0"], input')
                ?.focus({ preventScroll: true })}
    >
        {#if opened && enableDate}<CalendarPanel
                value={draftDate}
                min={min.slice(0, 10)}
                max={max.slice(0, 10)}
                onselect={(date) => {
                    draftDate = date
                    error = ''
                    if (!enableTime) commit(date)
                }}
            />{/if}
        {#if enableTime}<label class="lg-field lg-time-entry"
                ><span>时间</span><input
                    type="time"
                    step="1"
                    bind:value={draftTime}
                    min={enableDate
                        ? draftDate === min.slice(0, 10)
                            ? min.slice(11)
                            : undefined
                        : min || undefined}
                    max={enableDate
                        ? draftDate === max.slice(0, 10)
                            ? max.slice(11)
                            : undefined
                        : max || undefined}
                    oninput={() => (error = '')}
                /></label
            >{/if}
        {#if error}<p class="lg-input-error" role="alert">{error}</p>{/if}
        <div class="lg-panel-footer">
            {#if clearable}<button
                    data-lingui-clear
                    type="button"
                    class="lg-button lg-button-text lg-size-small"
                    disabled={!value}
                    onclick={() => commit('')}>清空</button
                >{/if}
            {#if enableTime}<button
                    type="button"
                    class="lg-button lg-button-primary lg-size-small"
                    disabled={!valid}
                    onclick={() => commit()}>确定</button
                >{:else}<button
                    type="button"
                    class="lg-button lg-button-text lg-size-small"
                    onclick={close}>关闭</button
                >{/if}
        </div>
    </FloatingPanel>
    {#if hint}<p class="lg-caption" id={`${id}-hint`}>{hint}</p>{/if}
</div>
