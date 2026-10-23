<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { dateRange, dateRangeError } from '../inputs/ranges'
    import DatePicker from '../controls/DatePicker.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let error = $state('')
    let value = $derived.by(() => {
        $snapshot
        return dateRange(resolve(node.value))
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    function set(key: 'start' | 'end', date: string) {
        if (disabled || node.readOnly) return
        const next = { ...value, [key]: date }
        error = dateRangeError(next, node.min as string, node.max as string)
        if (error) return
        try {
            nodeEvents.set(node.value as Binding, next)
        } catch (cause) {
            report(cause)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<fieldset
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class={`lg-range-field lg-field-status-${node.status ?? 'default'}`}
    {disabled}
>
    <legend>{label}</legend>
    <div class="lg-date-range">
        <DatePicker
            id={`${prefix}-${node.id}-start`}
            label="开始日期"
            value={value.start}
            min={node.min as string}
            max={value.end && (!node.max || value.end < String(node.max))
                ? value.end
                : (node.max as string)}
            {disabled}
            readOnly={node.readOnly}
            size={node.size}
            status={node.status}
            placeholder={node.placeholder}
            clearable={node.clearable}
            onvalue={(date) => set('start', date)}
        />
        <DatePicker
            id={`${prefix}-${node.id}-end`}
            label="结束日期"
            value={value.end}
            max={node.max as string}
            min={value.start && (!node.min || value.start > String(node.min))
                ? value.start
                : (node.min as string)}
            {disabled}
            readOnly={node.readOnly}
            size={node.size}
            status={node.status}
            placeholder={node.placeholder}
            clearable={node.clearable}
            onvalue={(date) => set('end', date)}
        />
    </div>
    {#if error}<p role="alert" class="lg-input-error">{error}</p>{:else if node.hint}<p
            class="lg-caption"
        >
            {node.hint}
        </p>{/if}
</fieldset>
