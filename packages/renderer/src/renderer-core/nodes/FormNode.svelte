<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic, JsonValue } from '../../protocol/types'
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
    let value = $derived(resolve(node.value))
    let disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    let maximum = $derived(Number(node.max ?? 5))
    let rating = $derived(
        typeof value === 'number' ? Math.max(0, Math.min(maximum, Math.round(value))) : 0,
    )
    function set(value: JsonValue) {
        if (disabled || node.readOnly) return
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Switch'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-switch-field"
    >
        <div class="lg-switch-copy">
            <span id={`${prefix}-${node.id}-label`}>{resolve(node.label)}</span>
            {#if node.description}<p id={`${prefix}-${node.id}-hint`} class="lg-caption">
                    {resolve(node.description)}
                </p>{/if}
        </div>
        <button
            type="button"
            role="switch"
            class="lg-switch"
            aria-checked={value === true}
            aria-labelledby={`${prefix}-${node.id}-label`}
            aria-describedby={node.description ? `${prefix}-${node.id}-hint` : undefined}
            {disabled}
            onclick={() => set(value !== true)}><span aria-hidden="true"></span></button
        >
    </div>
{:else if node.component === 'LingUI.SegmentedControl'}
    <fieldset
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-segmented-field"
        {disabled}
    >
        <legend>{resolve(node.label)}</legend>
        <div class="lg-segmented">
            {#each node.options ?? [] as option (option.value)}
                <label class="lg-segment" class:lg-active={value === option.value}>
                    <input
                        type="radio"
                        name={`${prefix}-${node.id}`}
                        value={option.value}
                        checked={value === option.value}
                        onchange={() => set(option.value)}
                    /><span>{option.label}</span>
                </label>
            {/each}
        </div>
    </fieldset>
{:else if node.component === 'LingUI.Rating'}
    <fieldset
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-rating"
        disabled={disabled || node.readOnly}
    >
        <legend>{resolve(node.label)}</legend>
        <div class="lg-rating-row">
            <div class="lg-rating-stars">
                {#each Array.from({ length: maximum }, (_, index) => index + 1) as score}
                    <label class="lg-rating-star" class:lg-active={score <= rating}>
                        <input
                            type="radio"
                            name={`${prefix}-${node.id}`}
                            value={score}
                            checked={rating === score}
                            aria-label={`${score} 星`}
                            onchange={() => set(score)}
                        />
                        <svg viewBox="0 0 24 24" aria-hidden="true"
                            ><path
                                d="m12 3 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 17.2l-5.56 2.92 1.06-6.2L3 9.53l6.22-.9Z"
                            /></svg
                        >
                    </label>
                {/each}
            </div>
            <span class="lg-caption" aria-live="polite">{rating} / {maximum}</span>
            {#if !node.readOnly}<button
                    type="button"
                    class="lg-rating-clear"
                    data-lingui-clear
                    disabled={disabled || rating === 0}
                    onclick={() => set(0)}>清除评分</button
                >{/if}
        </div>
    </fieldset>
{/if}
