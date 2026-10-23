<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { scatterGeometry, waterfallGeometry } from '../charts/workspace'
    import { shortChartNumber } from '../charts/formatting'
    let { node }: { node: ComponentNode } = $props()
    let scatter = $derived(scatterGeometry(node.points ?? []))
    let waterfall = $derived(waterfallGeometry(node.data ?? []))
    const number = (value: number) =>
        new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
    const dot = (x: number, y: number) => `M${x - 4},${y}a4,4 0 1 0 8,0a4,4 0 1 0 -8,0`
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<figure
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-workspace-chart"
>
    <figcaption>
        <h3 class="lg-data-heading">{node.label}</h3>
        {#if node.description}<p class="lg-caption">{node.description}</p>{/if}
    </figcaption>
    {#if node.component === 'LingUI.ScatterChart'}
        <div class="lg-scatter-axis-labels">
            <span class="lg-caption">{node.yLabel}</span><span class="lg-caption"
                >{node.xLabel}</span
            >
        </div>
        <svg
            class="lg-workspace-chart-svg"
            viewBox="0 0 348 204"
            role="img"
            aria-label={`${node.label}，${node.points?.length} 组数据，详细数值见下方`}
        >
            {#each [20, 59, 98, 137, 176] as y}<path
                    class="lg-chart-grid"
                    d={`M40,${y}H320`}
                />{/each}
            <path class="lg-chart-axis" d="M40,20V176H320" />
            <text x="34" y="24" text-anchor="end">{shortChartNumber(scatter.y.high)}</text><text
                x="34"
                y="176"
                text-anchor="end">{shortChartNumber(scatter.y.low)}</text
            >
            <text x="40" y="197">{shortChartNumber(scatter.x.low)}</text><text
                x="320"
                y="197"
                text-anchor="end">{shortChartNumber(scatter.x.high)}</text
            >
            {#each scatter.points as point}<path
                    class="lg-scatter-dot"
                    d={dot(point.cx, point.cy)}
                />{/each}
        </svg>
        <details class="lg-chart-values">
            <summary>查看 {node.points?.length} 组数据</summary>
            <div class="lg-workspace-chart-table">
                <table>
                    <thead
                        ><tr
                            ><th scope="col">记录</th><th scope="col">{node.xLabel}</th><th
                                scope="col">{node.yLabel}</th
                            ></tr
                        ></thead
                    ><tbody
                        >{#each node.points ?? [] as point}<tr
                                ><th scope="row">{point.label}</th><td>{number(point.x)}</td><td
                                    >{number(point.y)}</td
                                ></tr
                            >{/each}</tbody
                    >
                </table>
            </div>
        </details>
    {:else}
        <div class="lg-waterfall-total">
            <span class="lg-caption">最终合计</span><strong title={number(waterfall.total)}
                >{shortChartNumber(waterfall.total)}<small>{node.unit ?? ''}</small></strong
            >
        </div>
        <svg
            class="lg-workspace-chart-svg"
            viewBox="0 0 348 204"
            role="img"
            aria-label={`${node.label}，合计 ${number(waterfall.total)} ${node.unit ?? ''}，详细数值见下方`}
        >
            {#each [20, 59, 98, 137, 176] as y}<path
                    class="lg-chart-grid"
                    d={`M40,${y}H320`}
                />{/each}
            <path class="lg-chart-axis" d={`M40,${waterfall.zero}H320`} />
            <text x="34" y="24" text-anchor="end">{shortChartNumber(waterfall.high)}</text><text
                x="34"
                y="176"
                text-anchor="end">{shortChartNumber(waterfall.low)}</text
            >
            {#each waterfall.steps as item, index}
                <path
                    class={item.total
                        ? 'lg-waterfall-sum'
                        : item.value >= 0
                          ? 'lg-waterfall-positive'
                          : 'lg-waterfall-negative'}
                    d={`M${item.x},${item.y}h${item.width}v${item.height}h${-item.width}Z`}
                />
                <text x={item.x + item.width / 2} y="197" text-anchor="middle"
                    >{item.total ? 'Σ' : index + 1}</text
                >
            {/each}
        </svg>
        <ol class="lg-waterfall-legend">
            {#each waterfall.steps as item, index}<li>
                    <span
                        ><span
                            class={`lg-waterfall-marker ${item.total ? 'lg-waterfall-sum' : item.value >= 0 ? 'lg-waterfall-positive' : 'lg-waterfall-negative'}`}
                            aria-hidden="true"
                        ></span>{item.total ? '' : `${index + 1}. `}{item.label}</span
                    ><strong
                        >{!item.total && item.value > 0 ? '+' : ''}{number(item.value)}
                        {node.unit ?? ''}</strong
                    >
                </li>{/each}
        </ol>
    {/if}
</figure>
