<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    import { provideGroupDisabled, useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve, prefix } = useRenderer()
    const groupDisabled = useGroupDisabled()
    const flex: Record<string, string> = {
        start: 'flex-start',
        end: 'flex-end',
        spaceBetween: 'space-between',
    }
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let description = $derived.by(() => {
        $snapshot
        return String(resolve(node.description) ?? '')
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    provideGroupDisabled(() => node.component === 'LingUI.FormGroup' && disabled)
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Box'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-box lg-box-${node.variant ?? 'plain'} lg-padding-${node.padding ?? 'medium'} lg-gap-${node.gap ?? 'medium'} lg-flow-${node.direction ?? 'vertical'}`}
        style:align-items={flex[node.align ?? ''] ?? node.align ?? 'stretch'}
        style:justify-content={flex[node.justify ?? ''] ?? node.justify}
    >
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </div>
{:else if node.component === 'LingUI.Center'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-center"
        style:min-height={`${node.minHeight ?? 0}px`}
    >
        <div class="lg-center-content" style:max-width={`${node.maxWidth ?? 640}px`}>
            <NodeRenderer id={node.child!} />
        </div>
    </div>
{:else if node.component === 'LingUI.Spacer'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-spacer lg-spacer-${node.direction ?? 'vertical'} lg-space-${node.size ?? 'medium'}`}
        aria-hidden="true"
    ></div>
{:else if node.component === 'LingUI.Separator'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-separator lg-separator-${node.orientation ?? 'horizontal'}`}
        role="separator"
        aria-orientation={node.orientation ?? 'horizontal'}
    ></div>
{:else if node.component === 'LingUI.FormGroup'}
    {#snippet formFields()}
        <fieldset
            data-lingui-node={node.id}
            in:motionEnter|global={node.motion?.enter}
            out:motionExit|global={node.motion?.exit}
            use:motionFeedback={node.motion}
            class="lg-form-group"
            {disabled}
            aria-describedby={description ? `${prefix}-${node.id}-help` : undefined}
        >
            <legend>{label}</legend>
            {#if description}<p
                    class="lg-caption lg-form-group-help"
                    id={`${prefix}-${node.id}-help`}
                >
                    {description}
                </p>{/if}
            <NodeRenderer id={node.child!} />
        </fieldset>
    {/snippet}
    {#if node.events?.submit}
        <form
            data-lingui-node={node.id}
            in:motionEnter|global={node.motion?.enter}
            out:motionExit|global={node.motion?.exit}
            use:motionFeedback={node.motion}
            class="lg-form-shell"
        >
            {@render formFields()}
        </form>
    {:else}
        {@render formFields()}
    {/if}
{:else}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-button-group lg-gap-${node.gap ?? 'small'} lg-flow-${node.direction ?? 'horizontal'}`}
        role="group"
        aria-label={label}
    >
        {#each node.children ?? [] as child (child)}<NodeRenderer id={child} />{/each}
    </div>
{/if}
