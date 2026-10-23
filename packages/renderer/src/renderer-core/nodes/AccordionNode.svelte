<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
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
    const { motionEnter, motionExit, motionFeedback, motionDetails } = createNodeMotion()
</script>

<section
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-accordion"
    aria-label={String(node.label || '折叠内容')}
>
    {#each node.sections ?? [] as section (section.child)}
        <details
            use:motionDetails={{
                expanded: selected.includes(section.child),
                transition: node.motion?.transition,
            }}
        >
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
