<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const { runtime, state: snapshot, resolve: resolveValue, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let visible = $derived(resolve(node.value) !== false)
    function dismiss() {
        try {
            nodeEvents.set(node.value as Binding, false)
            nodeEvents.emit('close', { visible: false })
        } catch (error) {
            report(error)
        }
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

{#if node.component === 'LingUI.Alert'}
    {#if visible}<section
            data-lingui-node={node.id}
            in:motionEnter|global={node.motion?.enter}
            out:motionExit|global={node.motion?.exit}
            use:motionFeedback={node.motion}
            class={`lg-alert lg-tone-${node.tone ?? 'info'}`}
            role={node.tone === 'danger' ? 'alert' : 'status'}
        >
            <span class="lg-alert-symbol" aria-hidden="true"
                >{node.tone === 'success'
                    ? '✓'
                    : node.tone === 'warning' || node.tone === 'danger'
                      ? '!'
                      : 'i'}</span
            >
            <div class="lg-alert-copy">
                <strong>{resolve(node.title)}</strong>{#if node.description}<p>
                        {resolve(node.description)}
                    </p>{/if}
            </div>
            {#if node.dismissible}<button type="button" aria-label="关闭提示" onclick={dismiss}
                    >×</button
                >{/if}
        </section>{/if}
{:else if node.component === 'LingUI.Status'}
    <span
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class={`lg-status lg-tone-${node.tone ?? 'info'}`}
        ><span class="lg-status-dot" aria-hidden="true"></span>{resolve(node.text)}</span
    >
{:else}
    <div
        data-lingui-node={node.id}
        in:motionEnter|global={node.motion?.enter}
        out:motionExit|global={node.motion?.exit}
        use:motionFeedback={node.motion}
        class="lg-labeled-divider"
    >
        <span>{resolve(node.text)}</span>
    </div>
{/if}
