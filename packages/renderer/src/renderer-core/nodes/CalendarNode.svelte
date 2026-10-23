<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { dateInputValue } from '../../protocol/date-time'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import CalendarPanel from '../controls/CalendarPanel.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    let value = $derived.by(() => {
        $snapshot
        return dateInputValue(resolve(node.value), true, false)
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    function select(date: string) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, date)
            nodeEvents.emit('select', { date, value: date })
        } catch (cause) {
            report(cause)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<section
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-calendar"
    aria-labelledby={`${prefix}-${node.id}-label`}
>
    <h3 class="lg-data-heading" id={`${prefix}-${node.id}-label`}>{label}</h3>
    <CalendarPanel {value} initialMonth={node.month} {disabled} onselect={select} />
    <p class="lg-caption" aria-live="polite">{value ? `已选 ${value}` : '尚未选择日期'}</p>
</section>
