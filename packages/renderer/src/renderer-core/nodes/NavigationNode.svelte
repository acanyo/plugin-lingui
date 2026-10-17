<script lang="ts">
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { safeLinkUrl } from '../../protocol/link-url'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let url = $derived(safeLinkUrl(resolve(node.url)))
</script>

{#if node.component === 'LingUI.Link'}
    {#if url}<a
            data-lingui-node={node.id}
            class="lg-link"
            href={url}
            target={node.newWindow ? '_blank' : undefined}
            rel="noopener noreferrer"
            referrerpolicy="no-referrer"
        >
            {resolve(node.text)}{#if node.newWindow}<span class="lg-link-arrow" aria-hidden="true"
                    >↗</span
                ><span class="lg-sr-only">（新窗口打开）</span>{/if}</a
        >
    {:else}<span data-lingui-node={node.id} class="lg-link-unavailable">{resolve(node.text)}</span
        >{/if}
{:else if node.component === 'LingUI.Breadcrumbs'}
    <nav
        data-lingui-node={node.id}
        class="lg-breadcrumbs"
        aria-label={String(node.label || '面包屑导航')}
    >
        <ol>
            {#each node.items ?? [] as item, index}
                <li>
                    {#if index > 0}<span class="lg-breadcrumb-separator" aria-hidden="true">/</span
                        >{/if}
                    {#if index === (node.items?.length ?? 0) - 1}<span aria-current="page"
                            >{item.label}</span
                        >
                    {:else if safeLinkUrl(item.url)}<a
                            href={safeLinkUrl(item.url)}
                            rel="noopener noreferrer"
                            referrerpolicy="no-referrer">{item.label}</a
                        >
                    {:else}<span>{item.label}</span>{/if}
                </li>
            {/each}
        </ol>
    </nav>
{/if}
