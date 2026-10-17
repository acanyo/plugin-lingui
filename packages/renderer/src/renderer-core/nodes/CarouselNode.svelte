<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve: resolveValue, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let children = $derived(node.children ?? [])
    let value = $derived(resolve(node.value))
    let index = $derived(
        Math.min(
            children.length - 1,
            Math.max(
                0,
                typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0,
            ),
        ),
    )
    function go(next: number) {
        try {
            nodeEvents.set(node.value as Binding, Math.max(0, Math.min(children.length - 1, next)))
        } catch (error) {
            report(error)
        }
    }
</script>

<section
    data-lingui-node={node.id}
    class="lg-carousel"
    aria-label={String(node.label ?? '')}
    aria-roledescription="轮播"
>
    <div class="lg-carousel-slides">
        {#each children as child, i (child)}<section
                class="lg-carousel-slide"
                hidden={i !== index}
                aria-label={`第 ${i + 1} 页，共 ${children.length} 页`}
            >
                <NodeRenderer id={child} />
            </section>{/each}
    </div>
    <div class="lg-carousel-controls">
        <button
            type="button"
            aria-label="上一张"
            disabled={index <= 0}
            onclick={() => go(index - 1)}>←</button
        >
        <div class="lg-carousel-dots">
            {#each children as child, i (child)}<button
                    type="button"
                    aria-label={`查看第 ${i + 1} 张`}
                    aria-current={i === index ? 'true' : undefined}
                    onclick={() => go(i)}><span class="lg-sr-only">{i + 1}</span></button
                >{/each}
        </div>
        <span class="lg-caption" aria-live="polite">{index + 1} / {children.length}</span>
        <button
            type="button"
            aria-label="下一张"
            disabled={index >= children.length - 1}
            onclick={() => go(index + 1)}>→</button
        >
    </div>
</section>
