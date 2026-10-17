<script lang="ts">
    import { useNodeEvents } from '../../events/node'
    import type { Binding, ComponentNode } from '../../protocol/types'
    import { useRenderer } from '../context'
    import { useGroupDisabled } from '../inputs/group-state'
    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve, report } = useRenderer()
    let disabled = $derived.by(() => {
        $snapshot
        return groupDisabled() || Boolean(resolve(node.disabled))
    })
    let label = $derived.by(() => {
        $snapshot
        return String(resolve(node.label) ?? '')
    })
    let cards = $derived(
        node.boards!.flatMap((board) =>
            board.cards.map((card) => ({ ...card, original: board.id })),
        ),
    )
    let positions = $derived.by(() => {
        $snapshot
        const value = resolve(node.value)
        const state = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
        const allowed = new Set(node.boards!.map((board) => board.id))
        return Object.fromEntries(
            cards.map((card) => [
                card.id,
                typeof state[card.id] === 'string' && allowed.has(state[card.id] as string)
                    ? (state[card.id] as string)
                    : card.original,
            ]),
        )
    })
    function move(id: string, column: string) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, { ...positions, [id]: column })
            nodeEvents.emit('move', { id, from: positions[id] ?? '', to: column })
        } catch (error) {
            report(error)
        }
    }
</script>

<section data-lingui-node={node.id} class="lg-kanban" aria-label={label}>
    <h3 class="lg-data-heading">{label}</h3>
    <div class="lg-kanban-columns">
        {#each node.boards ?? [] as board (board.id)}
            <section class="lg-kanban-column" aria-label={board.title}>
                <header>
                    <h4>{board.title}</h4>
                    <span class="lg-kanban-count" aria-label="任务数量"
                        >{cards.filter((card) => positions[card.id] === board.id).length}</span
                    >
                </header>
                {#each cards.filter((card) => positions[card.id] === board.id) as card (card.id)}
                    <article class="lg-kanban-card" aria-label={card.title}>
                        {#if card.tag}<span class="lg-kanban-tag">{card.tag}</span>{/if}<strong
                            >{card.title}</strong
                        >
                        {#if card.description}<p class="lg-caption">{card.description}</p>{/if}
                        <select
                            aria-label={`移动「${card.title}」`}
                            value={board.id}
                            {disabled}
                            onchange={(event) => move(card.id, event.currentTarget.value)}
                            >{#each node.boards ?? [] as column}<option value={column.id}
                                    >{column.title}</option
                                >{/each}</select
                        >
                    </article>
                {:else}<p class="lg-kanban-empty lg-caption">暂无任务</p>{/each}
            </section>
        {/each}
    </div>
    <p class="lg-sr-only" aria-live="polite">
        {node
            .boards!.map(
                (board) =>
                    `${board.title} ${cards.filter((card) => positions[card.id] === board.id).length} 项`,
            )
            .join('，')}
    </p>
</section>
