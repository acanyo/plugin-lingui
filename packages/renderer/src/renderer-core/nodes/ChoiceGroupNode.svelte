<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve, report, prefix } = useRenderer()
    let value = $derived.by(() => {
        $snapshot
        return resolve(node.value)
    })
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let multiple = $derived(node.component === 'LingUI.CheckboxGroup')
    let selected = $derived(
        Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [],
    )
    function choose(id: string, checked: boolean) {
        if (disabled) return
        try {
            const allowed = new Set(node.options!.map((option) => option.value))
            const next = new Set(selected.filter((id) => allowed.has(id)))
            if (checked) next.add(id)
            else next.delete(id)
            nodeEvents.set(node.value as Binding, multiple ? [...next] : id)
        } catch (error) {
            report(error)
        }
    }
</script>

<fieldset
    data-lingui-node={node.id}
    class="lg-choice-group"
    class:lg-card-choice={!multiple}
    {disabled}
>
    <legend>{$snapshot && resolve(node.label)}</legend>
    {#if node.description}<p class="lg-caption">{resolve(node.description)}</p>{/if}
    <div class="lg-choice-options">
        {#each node.options ?? [] as option (option.value)}
            <label
                class="lg-choice-option"
                class:lg-choice-selected={multiple
                    ? selected.includes(option.value)
                    : value === option.value}
            >
                <input
                    type={multiple ? 'checkbox' : 'radio'}
                    name={`${prefix}-${node.id}`}
                    checked={multiple ? selected.includes(option.value) : value === option.value}
                    {disabled}
                    onchange={(event) => choose(option.value, event.currentTarget.checked)}
                />
                <span
                    ><strong>{option.label}</strong>{#if option.description}<span class="lg-caption"
                            >{option.description}</span
                        >{/if}</span
                >
            </label>
        {/each}
    </div>
</fieldset>
