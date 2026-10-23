<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic, JsonValue } from '../../protocol/types'
    import { rangePercent } from '../inputs/ranges'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, prefix, report, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined): JsonValue | undefined {
        $snapshot
        return resolveValue(value)
    }
    function set(value: JsonValue) {
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
    function numeric(event: Event) {
        const input = event.target as HTMLInputElement
        if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) return
        const value = Math.max(
            typeof node.min === 'number' ? node.min : -1e12,
            Math.min(typeof node.max === 'number' ? node.max : 1e12, input.valueAsNumber),
        )
        input.value = String(value)
        set(value)
    }
    let progress = $derived.by(() => {
        const value = Number(resolve(node.value))
        return Number.isFinite(value)
            ? Math.max(
                  0,
                  Math.min(100, (value / (typeof node.max === 'number' ? node.max : 100)) * 100),
              )
            : 0
    })
    let tone = $derived.by(() => {
        const value = String(resolve(node.tone) ?? 'info')
        return ['info', 'warning', 'success', 'danger'].includes(value) ? value : 'info'
    })
    let inputId = $derived(`${prefix}-${node.id}`)
    let textTag = $derived(['h1', 'h2', 'h3'].includes(node.variant ?? '') ? node.variant! : 'p')
    const flexValues: Record<string, string> = {
        start: 'flex-start',
        end: 'flex-end',
        spaceBetween: 'space-between',
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'Column' || node.component === 'Row'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-layout ${node.component === 'Row' ? 'lg-row' : 'lg-column'}`}
        style:align-items={flexValues[node.align ?? ''] ?? node.align}
        style:justify-content={flexValues[node.justify ?? ''] ?? node.justify}
    >
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </div>
{:else if node.component === 'Card'}<div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-card lg-card-${node.variant ?? 'outlined'}`}
    >
        <NodeRenderer id={node.child!} />
    </div>
{:else if node.component === 'Text'}<svelte:element
        this={textTag}
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-text lg-${node.variant ?? 'body'}`}>{resolve(node.text)}</svelte:element
    >
{:else if node.component === 'Icon'}<LinguiIcon name={node.name!} {node} />
{:else if node.component === 'Divider'}<hr
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-divider"
    />
{:else if node.component === 'CheckBox'}<label
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-check"
        ><input
            type="checkbox"
            checked={Boolean(resolve(node.value))}
            onchange={(event) => set(event.currentTarget.checked)}
        /><span>{resolve(node.label)}</span></label
    >
{:else if node.component === 'Slider'}<div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-field"
    >
        <div class="lg-field-heading">
            <label for={inputId}>{resolve(node.label)}</label>
            <span class="lg-field-value">{resolve(node.value)}</span>
        </div>
        <input
            id={inputId}
            type="range"
            value={Number(resolve(node.value))}
            min={node.min}
            max={node.max}
            step={node.step ?? 1}
            style:--lg-range-fill={`${rangePercent(resolve(node.value), Number(node.min ?? 0), Number(node.max ?? 100))}%`}
            oninput={numeric}
        />
    </div>
{:else if node.component === 'LingUI.Progress'}<div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-field"
    >
        <div class="lg-field-heading">
            <span>{resolve(node.label)}</span><span class="lg-caption">{Math.round(progress)}%</span
            >
        </div>
        <progress aria-label={String(resolve(node.label) ?? '')} value={progress} max="100"
            >{Math.round(progress)}%</progress
        >
    </div>
{:else if node.component === 'LingUI.Callout'}<div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-callout lg-tone-${tone}`}
    >
        <NodeRenderer id={node.child!} />
    </div>
{/if}
