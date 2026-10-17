<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { gaugeGeometry, radarGeometry, heatLevel } from '../charts/analytics'
    import { shortChartNumber } from '../charts/formatting'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve } = useRenderer()
    let gauge = $derived.by(() => {
        $snapshot
        return gaugeGeometry(resolve(node.value), Number(node.min), Number(node.max))
    })
    let radar = $derived(radarGeometry(node.data ?? [], Number(node.max)))
    let highest = $derived(Math.max(0, ...(node.matrix ?? []).flatMap((row) => row.cells)))
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
</script>

<figure
    data-lingui-node={node.id}
    class={`lg-analytics lg-analytics-${node.component.split('.').at(-1)?.toLowerCase()}`}
>
    <figcaption>
        <h3 class="lg-data-heading">{node.label}</h3>
        {#if node.description}<p class="lg-caption">{node.description}</p>{/if}
    </figcaption>
    {#if node.component === 'LingUI.Gauge'}
        <div class="lg-gauge-plot">
            <svg viewBox="0 0 224 128" aria-hidden="true"
                ><path
                    class="lg-gauge-track"
                    d="M24,112 A88,88 0 0 1 200,112"
                    fill="none"
                />{#if gauge.path}<path
                        class="lg-gauge-value"
                        d={gauge.path}
                        fill="none"
                    />{/if}</svg
            >
            <div class="lg-gauge-number">
                <strong title={format.format(gauge.actual)} aria-label={format.format(gauge.actual)}
                    >{shortChartNumber(gauge.actual)}</strong
                ><span>{node.unit || ''}</span>
            </div>
        </div>
        <div class="lg-gauge-scale">
            <span title={format.format(Number(node.min))}>{shortChartNumber(Number(node.min))}</span
            ><span class="lg-caption">当前值 / 范围</span><span
                title={format.format(Number(node.max))}>{shortChartNumber(Number(node.max))}</span
            >
        </div>
    {:else if node.component === 'LingUI.RadarChart'}
        <div class="lg-radar-plot" aria-hidden="true">
            <svg viewBox="0 0 320 260">
                {#each radar.grid as path}<path class="lg-radar-grid" d={path} fill="none" />{/each}
                {#each radar.axes as point}<path
                        class="lg-radar-grid"
                        d={`M160,130L${point.x},${point.y}`}
                        fill="none"
                    />{/each}
                <path class="lg-radar-area" d={radar.area} />
                {#each radar.labels as point}<text
                        x={point.x}
                        y={point.y}
                        text-anchor="middle"
                        dominant-baseline="middle">{point.index}</text
                    >{/each}
            </svg>
        </div>
        <ol class="lg-radar-legend">
            {#each node.data ?? [] as item}<li>
                    <span>{item.label}</span><strong
                        >{format.format(item.value)} / {format.format(Number(node.max))}</strong
                    >
                </li>{/each}
        </ol>
    {:else}
        <div class="lg-heatmap-scroll">
            <table class="lg-heatmap-table">
                <caption class="lg-sr-only"
                    >{node.label}{node.unit ? `（${node.unit}）` : ''}</caption
                ><thead
                    ><tr
                        ><th scope="col">项目</th>{#each node.columns ?? [] as column}<th
                                scope="col">{column}</th
                            >{/each}</tr
                    ></thead
                ><tbody>
                    {#each node.matrix ?? [] as row}<tr
                            ><th scope="row">{row.label}</th>{#each row.cells as value}<td
                                    ><span class={`lg-heat-level-${heatLevel(value, highest)}`}
                                        >{format.format(value)}{node.unit || ''}</span
                                    ></td
                                >{/each}</tr
                        >{/each}
                </tbody>
            </table>
        </div>
        <div class="lg-heatmap-key">
            <span class="lg-caption">低</span>{#each [0, 1, 2, 3, 4] as level}<span
                    class={`lg-heat-level-${level}`}
                    aria-hidden="true"
                ></span>{/each}<span class="lg-caption"
                >高 · {format.format(highest)}{node.unit || ''}</span
            >
        </div>
    {/if}
</figure>
