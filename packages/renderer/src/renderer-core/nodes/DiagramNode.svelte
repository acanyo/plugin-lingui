<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useNodeEvents } from '../../events/node'
    import NodeRenderer from '../NodeRenderer.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, prefix, report, resolve: resolveValue } = useRenderer()
    function resolve(value: ComponentNode['value']) {
        $snapshot
        return resolveValue(value)
    }
    let open = $derived(!node.expanded || Boolean(resolve(node.expanded)))
    let presentation = $derived(node.variant ?? 'tree')
    let childrenId = $derived(`${prefix}-${node.id}-children`)
    let tone = $derived.by(() => {
        const value = String(resolve(node.tone) ?? 'info')
        return ['info', 'warning', 'success', 'danger'].includes(value) ? value : 'info'
    })
    function toggle() {
        try {
            if (node.expanded) nodeEvents.set(node.expanded, !runtime.resolve(node.expanded))
        } catch (error) {
            report(error)
        }
    }
</script>

{#snippet heading()}
    {#if node.name}<LinguiIcon name={node.name} />{/if}
    <span data-lingui-node={node.id} class="lg-node-copy">
        <span class="lg-node-title">{resolve(node.title)}</span>
        {#if node.description}<span class="lg-node-description">{resolve(node.description)}</span
            >{/if}
    </span>
    {#if node.expanded}<span
            data-lingui-node={node.id}
            class:lg-expanded={open}
            class="lg-node-expand"
            aria-hidden="true"
        >
            <LinguiIcon name="chevronDown" />
        </span>{/if}
{/snippet}

{#if node.component === 'LingUI.Diagram'}
    <div
        data-lingui-node={node.id}
        class={`lg-diagram lg-diagram-${node.orientation ?? 'vertical'}`}
        role="group"
        aria-label="交互式架构图"
    >
        {#each node.children ?? [] as child, index (child)}
            {#if index > 0}<span class="lg-flow-arrow" aria-hidden="true"
                    ><LinguiIcon name="arrowDown" /></span
                >{/if}
            <div class="lg-diagram-entry"><NodeRenderer id={child} /></div>
        {/each}
    </div>
{:else}
    <div
        data-lingui-node={node.id}
        class={`lg-diagram-branch lg-diagram-${presentation}`}
        class:lg-diagram-accent={node.accent}
        data-tone={tone}
    >
        {#if node.expanded}
            <button
                type="button"
                class="lg-diagram-node"
                aria-expanded={open}
                aria-controls={childrenId}
                onclick={toggle}
            >
                {@render heading()}
            </button>
        {:else}<div class="lg-diagram-node">{@render heading()}</div>{/if}
        {#if node.children?.length}
            <div id={childrenId} class="lg-diagram-children" hidden={!open}>
                {#if open}
                    {#if presentation !== 'group'}
                        <svg
                            class="lg-connector"
                            viewBox="0 0 24 32"
                            preserveAspectRatio="none"
                            aria-hidden="true"><path d="M12 0V32" fill="none" /></svg
                        >
                    {/if}
                    <div
                        class={presentation === 'group' ? 'lg-diagram-grid' : 'lg-diagram-siblings'}
                    >
                        {#each node.children as child (child)}<NodeRenderer id={child} />{/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
{/if}
