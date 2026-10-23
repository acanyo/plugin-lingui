<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve } = useRenderer()
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<section
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class={`lg-chat-message lg-chat-${node.variant ?? 'assistant'}`}
    aria-label={`${node.sender}的消息`}
>
    <div class="lg-chat-identity">
        <span class="lg-chat-avatar" aria-hidden="true">{node.sender?.slice(0, 1)}</span><strong
            >{node.sender}</strong
        >{#if node.metadata}<span class="lg-caption">{node.metadata}</span>{/if}
    </div>
    <p class="lg-chat-body">{$snapshot && resolve(node.text)}</p>
</section>
