<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { dateInputValue } from '../../protocol/date-time'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import DatePicker from '../controls/DatePicker.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let value = $derived.by(() => {
        $snapshot
        return dateInputValue(resolve(node.value), !!node.enableDate, !!node.enableTime)
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? (node.enableDate ? '日期' : '时间'))
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    function set(value: string) {
        if (disabled || node.readOnly) return
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (cause) {
            report(cause)
        }
    }
</script>

<DatePicker
    nodeId={node.id}
    id={`${prefix}-${node.id}`}
    {label}
    {value}
    min={dateInputValue(node.min, !!node.enableDate, !!node.enableTime)}
    max={dateInputValue(node.max, !!node.enableDate, !!node.enableTime)}
    enableDate={node.enableDate}
    enableTime={node.enableTime}
    {disabled}
    readOnly={node.readOnly}
    size={node.size}
    status={node.status}
    hint={node.hint}
    placeholder={node.placeholder}
    clearable={node.clearable}
    onvalue={set}
/>
