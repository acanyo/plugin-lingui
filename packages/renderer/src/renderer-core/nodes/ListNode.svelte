<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { ComponentNode } from '../../protocol/types'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const events = useNodeEvents(() => node)
    const alignment: Record<string, string> = {
        start: 'flex-start',
        end: 'flex-end',
        center: 'center',
        stretch: 'stretch',
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<ul
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class={`lg-list lg-list-${node.direction ?? 'vertical'}`}
    style:align-items={alignment[node.align ?? 'stretch']}
>
    {#each node.items ?? [] as item, index}
        <li>
            {#if node.events?.select}<button
                    type="button"
                    class="lg-data-list-item is-selectable"
                    onclick={() =>
                        events.emit('select', { item, index, value: item.id ?? String(index) })}
                    ><strong>{item.label}</strong>{#if item.description}<span class="lg-caption"
                            >{item.description}</span
                        >{/if}</button
                >{:else}<div class="lg-data-list-item">
                    <strong>{item.label}</strong>{#if item.description}<span class="lg-caption"
                            >{item.description}</span
                        >{/if}
                </div>{/if}
        </li>
    {/each}
    {#each node.children ?? [] as child (child)}<li><NodeRenderer id={child} /></li>{/each}
</ul>
