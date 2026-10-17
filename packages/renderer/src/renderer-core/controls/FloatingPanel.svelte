<script lang="ts">
    import { tick, type Snippet } from 'svelte'
    import type { HTMLAttributes } from 'svelte/elements'
    import { bindEscapeScope } from '../inputs/escape-scope'
    import { positionFloatingPanel } from '../inputs/floating'
    let {
        open = $bindable(false),
        panel = $bindable(),
        anchor,
        container,
        id,
        role,
        labelledby,
        width,
        className = '',
        onopened,
        children,
    }: {
        open: boolean
        panel?: HTMLDivElement
        anchor?: HTMLElement
        container?: HTMLElement
        id: string
        role?: HTMLAttributes<HTMLDivElement>['role']
        labelledby?: string
        width?: number
        className?: string
        onopened?: (panel: HTMLDivElement) => void
        children: Snippet
    } = $props()
    export function close(restore = true) {
        open = false
        if (restore && anchor?.isConnected) anchor.focus({ preventScroll: true })
    }
    $effect(() => {
        if (!container) return
        return bindEscapeScope(
            container,
            () => open,
            () => close(),
        )
    })
    $effect(() => {
        if (!open || !panel || !anchor || !container) return
        const target = panel,
            trigger = anchor,
            wrapper = container
        let alive = true
        const position = () => {
            if (alive) positionFloatingPanel(trigger, target, width)
        }
        void tick().then(() => {
            if (!alive || !target.isConnected) return
            if (typeof target.showPopover === 'function') target.showPopover()
            else target.removeAttribute('popover')
            position()
            onopened?.(target)
        })
        const outside = (event: Event) => {
            if (!event.composedPath().includes(wrapper)) close(false)
        }
        const observer =
            typeof ResizeObserver === 'function' ? new ResizeObserver(position) : undefined
        observer?.observe(trigger)
        observer?.observe(target)
        document.addEventListener('pointerdown', outside)
        document.addEventListener('focusin', outside)
        window.addEventListener('resize', position)
        window.addEventListener('scroll', position, true)
        window.visualViewport?.addEventListener('resize', position)
        window.visualViewport?.addEventListener('scroll', position)
        return () => {
            alive = false
            if (typeof target.hidePopover === 'function' && target.isConnected) target.hidePopover()
            observer?.disconnect()
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('focusin', outside)
            window.removeEventListener('resize', position)
            window.removeEventListener('scroll', position, true)
            window.visualViewport?.removeEventListener('resize', position)
            window.visualViewport?.removeEventListener('scroll', position)
        }
    })
</script>

<div
    bind:this={panel}
    {id}
    {role}
    aria-labelledby={labelledby}
    class={`lg-select-panel lg-floating-panel ${className}`}
    popover="manual"
    hidden={!open}
>
    {@render children()}
</div>
