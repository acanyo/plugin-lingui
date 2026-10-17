<script lang="ts">
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { progressRing } from '../charts/compact'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let ring = $derived(progressRing(resolve(node.value), Number(node.max)))
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
</script>

<figure data-lingui-node={node.id} class="lg-progress-ring">
    <div
        class="lg-ring-plot"
        role="progressbar"
        aria-label={String(resolve(node.label) ?? '')}
        aria-valuemin="0"
        aria-valuemax={node.max as number}
        aria-valuenow={ring.ratio * Number(node.max)}
        aria-valuetext={`${format.format(ring.actual)} / ${format.format(Number(node.max))}`}
    >
        <svg viewBox="0 0 120 120" aria-hidden="true"
            ><path
                class="lg-ring-track"
                d="M60 14 A46 46 0 1 1 60 106 A46 46 0 1 1 60 14"
                fill="none"
            />{#if ring.path}<path class="lg-ring-value" d={ring.path} fill="none" />{/if}</svg
        ><strong>{Math.round(ring.ratio * 100)}%</strong>
    </div>
    <figcaption>
        <h3 class="lg-data-heading">{resolve(node.label)}</h3>
        <p class="lg-ring-numeric">
            {format.format(ring.actual)}<span class="lg-caption">
                / {format.format(Number(node.max))}</span
            >
        </p>
        {#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
    </figcaption>
</figure>
