<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    let { node }: { node: ComponentNode } = $props()
    let max = $derived(Math.max(1, ...(node.data ?? []).map((item) => item.value)))
    const format = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })
</script>

{#if node.component === 'LingUI.KeyValue'}
    <div data-lingui-node={node.id} class="lg-key-value">
        {#if node.label}<h3 class="lg-data-heading">{node.label}</h3>{/if}
        <dl>
            {#each node.entries ?? [] as entry}
                <div class="lg-key-value-row">
                    <dt>{entry.label}</dt>
                    <dd>{entry.value}</dd>
                </div>
            {/each}
        </dl>
    </div>
{:else}
    <figure data-lingui-node={node.id} class="lg-bar-chart">
        <figcaption>
            <h3 class="lg-data-heading">{node.label}</h3>
            {#if node.description}<p class="lg-caption">{node.description}</p>{/if}
        </figcaption>
        <ol class="lg-chart-data">
            {#each node.data ?? [] as item}
                <li>
                    <div class="lg-chart-label">
                        <span>{item.label}</span><span class="lg-chart-value"
                            >{format.format(item.value)}{#if node.unit}<span class="lg-chart-unit">
                                    {node.unit}</span
                                >{/if}</span
                        >
                    </div>
                    <div class="lg-chart-track" aria-hidden="true">
                        <div
                            class="lg-chart-bar"
                            style:width={`${(item.value / max) * 100}%`}
                        ></div>
                    </div>
                </li>
            {/each}
        </ol>
    </figure>
{/if}
