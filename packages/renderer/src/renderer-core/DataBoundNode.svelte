<script lang="ts">
    import type { Component } from 'svelte'
    import type { ComponentNode } from '../protocol/types'
    import { resolveCollectionNode } from '../data-bindings/resolve'
    import { useRenderer } from './context'
    import { readPath } from '../interaction-runtime/pointer'
    let {
        node,
        implementation: Implementation,
    }: { node: ComponentNode; implementation: Component<{ node: ComponentNode }> } = $props()
    const { state: snapshot, events, busy } = useRenderer()
    const resolved = $derived.by(() => {
        try {
            return { ...resolveCollectionNode(node, $snapshot), error: '' }
        } catch (cause) {
            return {
                node,
                empty: false,
                error: cause instanceof Error ? cause.message : '数据绑定失败',
            }
        }
    })
    const loading = $derived(
        node.dataState?.loading ? Boolean(read(node.dataState.loading.path)) : false,
    )
    const error = $derived(
        String(
            (node.dataState?.error ? read(node.dataState.error.path) : '') || resolved.error || '',
        ),
    )
    function read(path: string) {
        return readPath($snapshot, path)
    }
</script>

{#if loading}
    <div class="lg-data-state" role="status" aria-busy="true">
        <span class="lg-data-loading" aria-hidden="true"></span><span>正在加载数据…</span>
    </div>
{:else if error}
    <div class="lg-data-state lg-data-failure" role="alert">
        <strong>数据暂时无法显示</strong>
        <p>{error}</p>
        {#if node.events?.retry}<button
                type="button"
                class="lg-button lg-button-secondary"
                disabled={$busy.has(node.id)}
                onclick={() => events.fire(node, 'retry', null)}>重新加载</button
            >{/if}
    </div>
{:else if resolved.empty}
    <div class="lg-data-state" role="status">
        <span>{node.dataState?.emptyText || '暂无数据'}</span>
    </div>
{:else}
    <Implementation node={resolved.node} />
{/if}
