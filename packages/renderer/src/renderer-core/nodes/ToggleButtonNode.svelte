<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode, Dynamic, JsonValue } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve: resolveValue, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let value = $derived(resolve(node.value)),
        disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    function set(value: JsonValue) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, value)
        } catch (error) {
            report(error)
        }
    }
</script>

<div data-lingui-node={node.id} class="lg-toggle-field">
    <button
        type="button"
        class="lg-toggle-button"
        {disabled}
        aria-pressed={value === true}
        onclick={() => set(value !== true)}
        ><span aria-hidden="true">{value === true ? '✓' : '+'}</span>{resolve(node.label)}</button
    >{#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
</div>
