<script lang="ts">
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { safeMediaUrl } from '../../protocol/media-url'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let source = $derived(safeMediaUrl(resolve(node.url)))
    let failedSource = $state<string>()
    let label = $derived(String(resolve(node.label) ?? ''))
    let initials = $derived(Array.from(label.trim()).slice(0, 2).join('') || '?')
</script>

{#if node.component === 'LingUI.Avatar'}
    <div data-lingui-node={node.id} class="lg-avatar-profile">
        <div class={`lg-avatar lg-size-${node.size ?? 'medium'}`}>
            {#if source && source !== failedSource}<img
                    src={source}
                    alt={label}
                    loading="lazy"
                    decoding="async"
                    crossorigin="anonymous"
                    referrerpolicy="no-referrer"
                    onerror={() => {
                        failedSource = source
                    }}
                />
            {:else}<span role="img" aria-label={label || '头像'}>{initials}</span>{/if}
        </div>
        <div class="lg-avatar-copy">
            <p>{label}</p>
            {#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
        </div>
    </div>
{:else if node.component === 'LingUI.EmptyState'}
    <section data-lingui-node={node.id} class="lg-empty-state">
        <span class="lg-empty-icon" aria-hidden="true"
            ><LinguiIcon name={node.name ?? 'layers'} /></span
        >
        <h3>{resolve(node.title)}</h3>
        {#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
        {#if node.child}<div class="lg-empty-action"><NodeRenderer id={node.child} /></div>{/if}
    </section>
{:else if node.component === 'LingUI.Skeleton'}
    <div
        data-lingui-node={node.id}
        class={`lg-skeleton lg-skeleton-${node.variant ?? 'text'}`}
        role="status"
        aria-label={label || '内容加载中'}
    >
        <span class="lg-sr-only">{label || '内容加载中'}</span>
        <div class="lg-skeleton-blocks" aria-hidden="true">
            {#if node.variant === 'avatar'}<span class="lg-skeleton-avatar"></span>{/if}
            {#if node.variant === 'card'}<span class="lg-skeleton-cover"></span>{/if}
            <div class="lg-skeleton-lines">
                {#each Array.from({ length: node.lines ?? 3 }) as _}<span></span>{/each}
            </div>
        </div>
    </div>
{:else if node.component === 'LingUI.Spinner'}
    <div
        data-lingui-node={node.id}
        class={`lg-spinner-status lg-size-${node.size ?? 'medium'}`}
        role="status"
    >
        <span class="lg-spinner" aria-hidden="true"></span><span class="lg-caption">{label}</span>
    </div>
{/if}
