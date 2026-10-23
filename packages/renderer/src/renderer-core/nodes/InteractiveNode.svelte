<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const {
        runtime,
        surface,
        state: snapshot,
        prefix,
        report,
        resolve: resolveValue,
    } = useRenderer()
    function resolve(value: ComponentNode['value']) {
        $snapshot
        return resolveValue(value)
    }
    let expanded = $derived(Boolean(resolve(node.expanded)))
    let selected = $derived(resolve(node.value))
    let step = $derived(
        Math.max(0, Math.min((node.children?.length ?? 1) - 1, Number(selected) || 0)),
    )
    function set(value: string[] | number) {
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
    function toggle(event: Event) {
        event.preventDefault()
        try {
            const actions = Object.values(surface.nodes)
                .filter(
                    (item) =>
                        item.id !== node.id &&
                        node.exclusiveGroup &&
                        !runtime.resolve(node.multiple) &&
                        item.exclusiveGroup === node.exclusiveGroup &&
                        item.expanded,
                )
                .map((item) => ({ type: 'hide' as const, path: item.expanded!.path }))
            runtime.dispatch({
                functionCall: {
                    call: 'lingui.dispatch',
                    args: {
                        actions: [...actions, { type: 'toggleState', path: node.expanded!.path }],
                    },
                },
            })
            nodeEvents.emit('change', { value: Boolean(runtime.resolve(node.expanded)) })
        } catch (error) {
            report(error)
        }
    }
    function pick(value: string) {
        const current = Array.isArray(selected) ? (selected as string[]) : []
        set(
            node.variant === 'multipleSelection'
                ? current.includes(value)
                    ? current.filter((item) => item !== value)
                    : [...current, value]
                : [value],
        )
    }
    const { motionEnter, motionExit, motionFeedback, motionDetails } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Collapse'}<details
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-collapse"
        use:motionDetails={{ expanded, transition: node.motion?.transition }}
    >
        <summary aria-expanded={expanded} onclick={toggle}
            ><span>{resolve(node.title)}</span><span class="lg-chevron" aria-hidden="true"
                ><LinguiIcon name="chevronDown" /></span
            ></summary
        >
        <div class="lg-collapse-content"><NodeRenderer id={node.child!} /></div>
    </details>
{:else if node.component === 'ChoicePicker'}<fieldset
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-choice"
    >
        <legend>{resolve(node.label)}</legend
        >{#each node.options ?? [] as option (option.value)}<label
                class:lg-selected={Array.isArray(selected) && selected.includes(option.value)}
                class="lg-option"
                ><input
                    type={node.variant === 'multipleSelection' ? 'checkbox' : 'radio'}
                    name={`${prefix}-${node.id}`}
                    value={option.value}
                    checked={Array.isArray(selected) && selected.includes(option.value)}
                    onchange={() => pick(option.value)}
                /><span>{option.label}</span></label
            >{/each}
    </fieldset>
{:else if node.component === 'LingUI.Steps'}<div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-steps"
    >
        <div class="lg-step-header">
            <p class="lg-muted" aria-live="polite">步骤 {step + 1} / {node.children!.length}</p>
            <div class="lg-step-track" aria-hidden="true">
                {#each node.children ?? [] as child, index (child)}<span
                        class="lg-step-segment"
                        class:lg-complete={index <= step}
                    ></span>{/each}
            </div>
        </div>
        <div class="lg-step-content">
            {#if node.children?.[step]}<NodeRenderer id={node.children[step]!} />{/if}
        </div>
        <div class="lg-row lg-step-actions">
            <button
                type="button"
                class="lg-button"
                disabled={step === 0}
                onclick={() => set(step - 1)}>上一步</button
            ><button
                type="button"
                class="lg-button lg-button-primary"
                disabled={step === node.children!.length - 1}
                onclick={() => set(step + 1)}>下一步</button
            >
        </div>
    </div>{/if}
