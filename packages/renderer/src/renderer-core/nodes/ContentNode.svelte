<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let tone = $derived.by(() => {
        const value = String(resolve(node.tone) ?? 'info')
        return ['info', 'success', 'warning', 'danger'].includes(value) ? value : 'info'
    })
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Badge'}
    <span
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-badge lg-tone-${tone} lg-badge-${node.variant ?? 'soft'} lg-badge-size-${node.size ?? 'small'}`}
        >{resolve(node.text)}</span
    >
{:else if node.component === 'LingUI.Quote'}
    <figure
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-quote"
    >
        <blockquote>{resolve(node.text)}</blockquote>
        {#if node.label || node.description}
            <figcaption>
                {#if node.label}<span class="lg-quote-author">{resolve(node.label)}</span>{/if}
                {#if node.description}<span>{resolve(node.description)}</span>{/if}
            </figcaption>
        {/if}
    </figure>
{:else if node.component === 'LingUI.Metric'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-metric"
    >
        <p class="lg-metric-label">{resolve(node.label)}</p>
        <p class="lg-metric-value" aria-live="polite" aria-atomic="true">{resolve(node.value)}</p>
        {#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
    </div>
{:else if node.component === 'LingUI.Table'}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-table-block"
    >
        <h3 class="lg-table-heading">{node.label}</h3>
        <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll wide tables.) -->
        <div class="lg-table-scroll" role="region" aria-label={String(node.label)} tabindex="0">
            <table class="lg-table">
                <caption class="lg-sr-only">{node.label}</caption>
                <thead
                    ><tr
                        >{#each node.columns ?? [] as column}<th scope="col">{column}</th
                            >{/each}</tr
                    ></thead
                >
                <tbody>
                    {#each node.rows ?? [] as row}
                        <tr
                            ><th scope="row">{row.label}</th>{#each row.cells as cell}<td>{cell}</td
                                >{/each}</tr
                        >
                    {/each}
                </tbody>
            </table>
        </div>
    </div>
    <p
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-table-hint lg-caption"
    >
        表格较宽时，可左右滑动查看。
    </p>
{/if}
