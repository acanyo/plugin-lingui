<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import { lineGeometry } from '../charts/geometry'
    import { funnelGeometry } from '../charts/compact'
    let { node }: { node: ComponentNode } = $props()
    let data = $derived(node.data ?? []),
        line = $derived(lineGeometry(data)),
        funnel = $derived(funnelGeometry(data))
    let delta = $derived((data.at(-1)?.value ?? 0) - (data[0]?.value ?? 0))
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
    const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 })
</script>

<figure data-lingui-node={node.id} class="lg-compact-chart">
    <figcaption>
        <h3 class="lg-data-heading">{node.label}</h3>
        {#if node.description}<p class="lg-caption">{node.description}</p>{/if}
    </figcaption>
    {#if node.component === 'LingUI.Sparkline'}
        <div class="lg-spark-summary">
            <strong
                >{format.format(data.at(-1)?.value ?? 0)}<span class="lg-caption"
                    >{node.unit || ''}</span
                ></strong
            ><span class="lg-caption"
                >变化 {delta > 0 ? '+' : ''}{format.format(delta)}{node.unit || ''}</span
            >
        </div>
        <svg
            class="lg-spark-plot"
            viewBox="0 0 320 168"
            preserveAspectRatio="none"
            aria-hidden="true"
            ><path class="lg-chart-grid" d="M24 148H296" fill="none" /><path
                class="lg-line-path"
                d={line.path}
                fill="none"
            />{#each line.points as point}<path
                    class="lg-line-point"
                    d={`M${point.x - 2},${point.y} a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0`}
                />{/each}</svg
        >
        <div class="lg-spark-labels">
            <span>{data[0]?.label}</span><span>{data.at(-1)?.label}</span>
        </div>
        <details class="lg-chart-data">
            <summary>查看全部数据</summary>
            <ol class="lg-chart-legend">
                {#each data as item}<li>
                        <span class="lg-legend-label">{item.label}</span><span
                            >{format.format(item.value)}{node.unit || ''}</span
                        >
                    </li>{/each}
            </ol>
        </details>
    {:else}
        <ol class="lg-funnel-stages">
            {#each data as item, index}<li>
                    <div class="lg-funnel-label">
                        <span>{item.label}</span><strong
                            >{format.format(item.value)}{node.unit || ''}</strong
                        ><span class="lg-caption">{percent.format(funnel[index]!.ratio)}</span>
                    </div>
                    <svg viewBox="0 0 300 40" preserveAspectRatio="none" aria-hidden="true"
                        ><path class={`lg-series-${index % 6}`} d={funnel[index]!.path} /></svg
                    >
                </li>{/each}
        </ol>
        <p class="lg-caption">比例以第一阶段为基准。</p>
    {/if}
</figure>
