<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { stringList } from '../inputs/values'
    import { useRenderer } from '../context'
    import NodeRenderer from '../NodeRenderer.svelte'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve, report } = useRenderer()
    let selected = $derived.by(() => {
        $snapshot
        return stringList(resolve(node.value), node.allowMultiple ? 12 : 1, 80)
    })
    function toggle(child: string) {
        const value = selected.includes(child)
            ? selected.filter((item) => item !== child)
            : node.allowMultiple
              ? [...selected, child]
              : [child]
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
</script>

<section
    data-lingui-node={node.id}
    class="lg-accordion"
    aria-label={String(node.label || '折叠内容')}
>
    {#each node.sections ?? [] as section (section.child)}
        <details open={selected.includes(section.child)}>
            <summary
                onclick={(event) => {
                    event.preventDefault()
                    toggle(section.child)
                }}
                ><span>{section.title}</span><span class="lg-accordion-arrow" aria-hidden="true"
                    >⌄</span
                ></summary
            >
            <div class="lg-accordion-content"><NodeRenderer id={section.child} /></div>
        </details>
    {/each}
</section>
