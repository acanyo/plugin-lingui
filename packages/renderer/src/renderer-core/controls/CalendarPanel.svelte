<script lang="ts">
    import { tick, untrack } from 'svelte'
    import { monthCells, shiftMonth, shiftDay, dateInMonth } from '../inputs/calendar'
    import LinguiIcon from '../LinguiIcon.svelte'
    let {
        value = '',
        initialMonth,
        min = '',
        max = '',
        disabled = false,
        onselect,
    }: {
        value?: string
        initialMonth?: string
        min?: string
        max?: string
        disabled?: boolean
        onselect: (date: string) => void
    } = $props()
    const today = new Date()
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    let month = $state(
        untrack(() => value.slice(0, 7) || initialMonth || min.slice(0, 7) || currentMonth),
    )
    let focusDate = $state(untrack(() => value || min || `${month}-01`))
    let element: HTMLDivElement | undefined = $state()
    let cells = $derived(monthCells(month))
    function blocked(date: string) {
        return disabled || (!!min && date < min) || (!!max && date > max)
    }
    let tabDate = $derived(
        cells.some((cell) => cell.date === focusDate && !blocked(cell.date))
            ? focusDate
            : cells.find((cell) => cell.valid && cell.inMonth && !blocked(cell.date))?.date,
    )
    $effect(() => {
        if (value) {
            month = value.slice(0, 7)
            focusDate = value
        }
    })
    async function focus(date: string) {
        date = min && date < min ? min : max && date > max ? max : date
        month = date.slice(0, 7)
        focusDate = date
        await tick()
        element
            ?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)
            ?.focus({ preventScroll: true })
    }
    function keyboard(event: KeyboardEvent, date: string) {
        const column = cells.findIndex((cell) => cell.date === date) % 7
        let next =
            event.key === 'ArrowLeft'
                ? shiftDay(date, -1)
                : event.key === 'ArrowRight'
                  ? shiftDay(date, 1)
                  : event.key === 'ArrowUp'
                    ? shiftDay(date, -7)
                    : event.key === 'ArrowDown'
                      ? shiftDay(date, 7)
                      : event.key === 'Home'
                        ? shiftDay(date, -column)
                        : event.key === 'End'
                          ? shiftDay(date, 6 - column)
                          : undefined
        if (event.key === 'PageUp' || event.key === 'PageDown')
            next = dateInMonth(date, shiftMonth(month, event.key === 'PageUp' ? -1 : 1))
        if (next && !disabled) {
            event.preventDefault()
            event.stopPropagation()
            void focus(next)
        }
    }
</script>

<div class="lg-calendar-body" bind:this={element}>
    <div class="lg-calendar-heading">
        <button
            type="button"
            aria-label="上个月"
            disabled={disabled || month === '0001-01' || (!!min && month <= min.slice(0, 7))}
            onclick={() => {
                month = shiftMonth(month, -1)
                focusDate = dateInMonth(focusDate, month)
            }}><span class="lg-chevron-left"><LinguiIcon name="chevronDown" /></span></button
        >
        <strong aria-live="polite"
            >{Number(month.slice(0, 4))} 年 {Number(month.slice(5))} 月</strong
        >
        <button
            type="button"
            aria-label="下个月"
            disabled={disabled || month === '9999-12' || (!!max && month >= max.slice(0, 7))}
            onclick={() => {
                month = shiftMonth(month, 1)
                focusDate = dateInMonth(focusDate, month)
            }}><span class="lg-chevron-right"><LinguiIcon name="chevronDown" /></span></button
        >
    </div>
    <div class="lg-calendar-week" aria-hidden="true">
        {#each ['一', '二', '三', '四', '五', '六', '日'] as day}<span>{day}</span>{/each}
    </div>
    <div class="lg-calendar-days" role="group" aria-label="选择日期">
        {#each cells as cell (cell.date)}<button
                type="button"
                data-date={cell.date}
                class:lg-calendar-adjacent={!cell.inMonth}
                disabled={!cell.valid || blocked(cell.date)}
                tabindex={cell.date === tabDate ? 0 : -1}
                aria-label={cell.date}
                aria-pressed={value === cell.date}
                onfocus={() => (focusDate = cell.date)}
                onclick={() => {
                    if (!blocked(cell.date)) {
                        focusDate = cell.date
                        onselect(cell.date)
                    }
                }}
                onkeydown={(event) => keyboard(event, cell.date)}>{cell.day}</button
            >{/each}
    </div>
</div>
