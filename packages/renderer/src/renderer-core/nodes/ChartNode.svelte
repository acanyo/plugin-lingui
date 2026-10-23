<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { lineGeometry, donutGeometry } from '../charts/geometry'
    import { shortChartNumber } from '../charts/formatting'
    let { node }: { node: ComponentNode } = $props()
    let data = $derived(node.data ?? [])
    let line = $derived(lineGeometry(data))
    let donut = $derived(donutGeometry(data))
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
    const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 })
    const compact = new Intl.NumberFormat('zh-CN', {
        notation: 'compact',
        maximumFractionDigits: 1,
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<figure
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class:lg-donut-chart={node.component === 'LingUI.DonutChart'}
    class="lg-chart"
>
    <figcaption>
        <h3 class="lg-data-heading">{node.label}</h3>
        {#if node.description}<p class="lg-caption">{node.description}</p>{/if}
    </figcaption>
    {#if node.component === 'LingUI.LineChart'}
        <div class="lg-line-plot" aria-hidden="true">
            <div class="lg-line-axis">
                <span>{shortChartNumber(line.high)}</span><span>{shortChartNumber(line.low)}</span>
            </div>
            <svg viewBox="0 0 320 168" preserveAspectRatio="none">
                <path class="lg-chart-grid" d="M24 20H296 M24 84H296 M24 148H296" fill="none" />
                <path class="lg-line-path" d={line.path} fill="none" />
                {#each line.points as point}<path
                        class="lg-line-point"
                        d={`M${point.x - 2},${point.y} a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0`}
                    />{/each}
            </svg>
        </div>
    {/if}
    <div class="lg-chart-body">
        {#if node.component === 'LingUI.DonutChart'}
            <div class="lg-donut-plot">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                    <path
                        class="lg-donut-track"
                        d="M100 28 A72 72 0 1 1 100 172 A72 72 0 1 1 100 28"
                        fill="none"
                    />
                    {#each donut.segments as path, index}{#if path}<path
                                class={`lg-donut-segment lg-series-${index % 6}`}
                                d={path}
                                fill="none"
                            />{/if}{/each}
                </svg>
                <div class="lg-donut-total">
                    <span class="lg-caption">{donut.total ? '合计' : '暂无占比数据'}</span><strong
                        title={format.format(donut.total)}>{compact.format(donut.total)}</strong
                    >{#if node.unit}<span class="lg-caption">{node.unit}</span>{/if}
                </div>
            </div>
        {/if}
        <ol class="lg-chart-legend">
            {#each data as item, index}<li>
                    {#if node.component === 'LingUI.DonutChart'}<span
                            class={`lg-legend-dot lg-series-${index % 6}`}
                            aria-hidden="true"
                        ></span>{/if}
                    <span class="lg-legend-label">{item.label}</span><span class="lg-chart-value"
                        >{format.format(item.value)}{node.unit || ''}</span
                    >
                    {#if node.component === 'LingUI.DonutChart'}<span class="lg-caption"
                            >{percent.format(donut.total ? item.value / donut.total : 0)}</span
                        >{/if}
                </li>{/each}
        </ol>
    </div>
</figure>
