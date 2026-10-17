<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve } = useRenderer()
</script>

{#if node.component === 'LingUI.InlineCode'}
    <code data-lingui-node={node.id} class="lg-inline-code">{$snapshot && resolve(node.text)}</code>
{:else}
    <mark data-lingui-node={node.id} class={`lg-highlight lg-highlight-${node.tone ?? 'accent'}`}
        >{$snapshot && resolve(node.text)}</mark
    >
{/if}
