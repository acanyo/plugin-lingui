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

{#if node.component === 'LingUI.KeyboardShortcut'}
    <div data-lingui-node={node.id} class="lg-shortcut">
        <span>{resolve(node.label)}</span><span
            class="lg-shortcut-keys"
            aria-label={node.keys?.join(' + ')}
            >{#each node.keys ?? [] as key, i}{#if i}<span aria-hidden="true">+</span>{/if}<kbd
                    >{key}</kbd
                >{/each}</span
        >
    </div>
{:else}
    <div data-lingui-node={node.id} class="lg-file-card">
        <span class="lg-file-icon" aria-hidden="true"
            ><svg
                class="lg-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M14 3H5v18h14V8L14 3Z M14 3v5h5 M8 12h8 M8 16h5" /></svg
            ></span
        >
        <div class="lg-file-details">
            <h3 class="lg-data-heading">{resolve(node.label)}</h3>
            {#if node.description}<p class="lg-caption">
                    {resolve(node.description)}
                </p>{/if}{#if node.metadata}<span class="lg-file-meta">{node.metadata}</span>{/if}
        </div>
        {#if url}<a
                class="lg-file-link"
                href={url}
                target={node.newWindow ? '_blank' : undefined}
                rel="noopener noreferrer"
                referrerpolicy="no-referrer"
                aria-label={`打开 ${resolve(node.label)}`}
                >打开<span aria-hidden="true">{node.newWindow ? ' ↗' : ' →'}</span
                >{#if node.newWindow}<span class="lg-sr-only">（新窗口）</span>{/if}</a
            >{:else}<span class="lg-caption">暂无链接</span>{/if}
    </div>
{/if}
