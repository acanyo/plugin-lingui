<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic, JsonValue } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    import { clampNumber, numberRange, stepNumber, rangePercent } from '../inputs/ranges'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve: resolveValue, prefix, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    let value = $derived(resolve(node.value))
    let min = $derived(Number(node.min ?? 0)),
        max = $derived(Number(node.max ?? 100))
    let numeric = $derived(clampNumber(value, min, max))
    let range = $derived(numberRange(value, min, max))
    function set(value: JsonValue) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (cause) {
            report(cause)
        }
    }
    function setEndpoint(key: 'start' | 'end', input: HTMLInputElement) {
        if (disabled) return
        const requested = Number(input.value)
        const value =
            key === 'start' ? Math.min(requested, range.end) : Math.max(requested, range.start)
        // Repeated crossing can leave derived state unchanged; still restore the native thumb.
        input.value = String(value)
        set({ ...range, [key]: value })
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.RangeSlider'}
    <fieldset
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-range-field"
        {disabled}
    >
        <legend>{resolve(node.label)}</legend>
        <div class="lg-range-summary">
            <span>{range.start}{node.unit || ''}</span><span aria-hidden="true">—</span><span
                >{range.end}{node.unit || ''}</span
            >
        </div>
        <div class="lg-range-controls">
            <label
                ><span>下限</span><input
                    type="range"
                    {min}
                    {max}
                    step={node.step ?? 1}
                    value={range.start}
                    style:--lg-range-fill={`${rangePercent(range.start, min, max)}%`}
                    aria-valuetext={`${range.start}${node.unit || ''}`}
                    oninput={(event) => setEndpoint('start', event.currentTarget)}
                /></label
            >
            <label
                ><span>上限</span><input
                    type="range"
                    {min}
                    {max}
                    step={node.step ?? 1}
                    value={range.end}
                    style:--lg-range-fill={`${rangePercent(range.end, min, max)}%`}
                    aria-valuetext={`${range.end}${node.unit || ''}`}
                    oninput={(event) => setEndpoint('end', event.currentTarget)}
                /></label
            >
        </div>
    </fieldset>
{:else}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-field"
    >
        <label for={`${prefix}-${node.id}`}>{resolve(node.label)}</label>
        <div class="lg-number-stepper">
            <button
                type="button"
                disabled={disabled || numeric <= min}
                aria-label="减少数值"
                onclick={() => set(stepNumber(numeric, -1, min, max, node.step ?? 1))}>−</button
            >
            <input
                id={`${prefix}-${node.id}`}
                type="number"
                {min}
                {max}
                step={node.step ?? 1}
                value={numeric}
                {disabled}
                onchange={(event) => {
                    if (event.currentTarget.value.trim()) {
                        const next = clampNumber(Number(event.currentTarget.value), min, max)
                        set(next)
                        event.currentTarget.value = String(next)
                    } else event.currentTarget.value = String(numeric)
                }}
            />
            {#if node.unit}<span class="lg-caption">{node.unit}</span>{/if}
            <button
                type="button"
                disabled={disabled || numeric >= max}
                aria-label="增加数值"
                onclick={() => set(stepNumber(numeric, 1, min, max, node.step ?? 1))}>+</button
            >
        </div>
    </div>
{/if}
