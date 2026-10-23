<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { useNodeEvents } from '../../events/node'
    import { tick } from 'svelte'
    import type { Binding, ComponentNode, Dynamic } from '../../protocol/types'
    import { useRenderer } from '../context'
    import LinguiIcon from '../LinguiIcon.svelte'
    import { hexColor } from '../inputs/values'
    import { colorPresets, hexToHsv, hsvToHex, type HsvColor } from '../inputs/colors'
    import { useGroupDisabled } from '../inputs/group-state'
    import { bindEscapeScope } from '../inputs/escape-scope'

    let { node }: { node: ComponentNode } = $props()
    const nodeEvents = useNodeEvents(() => node)
    const groupDisabled = useGroupDisabled()
    const { runtime, state: snapshot, resolve: resolveValue, prefix, report } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let color = $derived(hexColor(resolve(node.value)) ?? '#2563eb')
    let disabled = $derived(groupDisabled() || Boolean(resolve(node.disabled)))
    let open = $state(false)
    let error = $state('')
    let hsv = $state(hexToHsv('#2563eb'))
    let syncedColor = $state('')
    let picker: HTMLDivElement | undefined = $state()
    let trigger: HTMLButtonElement | undefined = $state()
    let panel: HTMLFieldSetElement | undefined = $state()
    let pureHue = $derived(hsvToHex({ hue: hsv.hue, saturation: 100, brightness: 100 }))
    let saturationStart = $derived(hsvToHex({ ...hsv, saturation: 0 }))
    let saturationEnd = $derived(hsvToHex({ ...hsv, saturation: 100 }))
    let brightnessEnd = $derived(hsvToHex({ ...hsv, brightness: 100 }))

    $effect(() => {
        if (color !== syncedColor) {
            hsv = hexToHsv(color, hsv.hue)
            syncedColor = color
        }
    })
    $effect(() => {
        if (disabled) open = false
    })
    $effect(() => {
        if (picker) return bindEscapeScope(picker, () => open, close)
    })
    function close() {
        open = false
        trigger?.focus()
    }
    async function toggle() {
        if (disabled) return
        if (open) close()
        else {
            open = true
            await tick()
            const first =
                panel?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ??
                panel?.querySelector<HTMLButtonElement>('button')
            first?.focus()
        }
    }
    function set(next: string, nextHsv?: HsvColor) {
        if (disabled) return
        try {
            nodeEvents.set(node.value as Binding, next)
            if (nextHsv) {
                hsv = nextHsv
                syncedColor = next
            }
            error = ''
        } catch (cause) {
            report(cause)
        }
    }
    function adjust(channel: keyof HsvColor, value: number) {
        const next = { ...hsv, [channel]: value }
        set(hsvToHex(next), next)
    }
    function editHex(event: Event) {
        if (disabled) return
        const input = event.currentTarget as HTMLInputElement
        const next = hexColor(input.value.trim())
        if (next) {
            set(next)
            input.value = next
        } else error = '请输入六位十六进制颜色，例如 #2563eb。'
    }
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<svelte:window
    onclick={(event) => {
        if (picker && !event.composedPath().includes(picker)) open = false
    }}
/>
<div
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-field"
>
    <label for={`${prefix}-${node.id}`}>{resolve(node.label)}</label>
    <div
        class="lg-color-picker"
        bind:this={picker}
        data-lingui-escape-scope={open ? 'open' : undefined}
        onfocusout={(event) => {
            if (event.relatedTarget instanceof Node && !picker?.contains(event.relatedTarget))
                open = false
        }}
    >
        <div class="lg-color-input">
            <button
                type="button"
                class="lg-color-toggle"
                bind:this={trigger}
                {disabled}
                aria-label={`${resolve(node.label)}色板`}
                aria-expanded={open}
                aria-controls={`${prefix}-${node.id}-palette`}
                onclick={toggle}
                ><span class="lg-color-swatch" style:background={color}></span></button
            >
            <input
                id={`${prefix}-${node.id}`}
                type="text"
                value={color}
                {disabled}
                maxlength="7"
                spellcheck="false"
                autocomplete="off"
                aria-invalid={!!error}
                aria-describedby={error ? `${prefix}-${node.id}-error` : undefined}
                onchange={editHex}
                onkeydown={(event) => {
                    if (event.key === 'Enter' && !event.isComposing) {
                        event.preventDefault()
                        editHex(event)
                    }
                    if (event.key === 'ArrowDown' && !open) {
                        event.preventDefault()
                        void toggle()
                    }
                }}
            />
            <button
                type="button"
                class="lg-color-expand"
                {disabled}
                aria-label={open ? '收起色板' : '展开色板'}
                aria-expanded={open}
                aria-controls={`${prefix}-${node.id}-palette`}
                onclick={toggle}
                ><span class="lg-select-chevron"><LinguiIcon name="chevronDown" /></span></button
            >
        </div>
        {#if open}
            <fieldset
                class="lg-color-panel"
                id={`${prefix}-${node.id}-palette`}
                bind:this={panel}
                {disabled}
            >
                <legend class="lg-sr-only">{resolve(node.label)}选色面板</legend>
                <div class="lg-color-panel-heading">
                    <span>预设颜色</span><button type="button" class="lg-color-done" onclick={close}
                        >完成</button
                    >
                </div>
                <div class="lg-color-presets">
                    {#each colorPresets as preset}
                        <button
                            type="button"
                            aria-label={`${preset.name} ${preset.value}`}
                            aria-pressed={color === preset.value}
                            title={`${preset.name} ${preset.value}`}
                            onclick={() => set(preset.value)}
                            ><span style:background={preset.value}></span></button
                        >
                    {/each}
                </div>
                <div class="lg-color-adjustments">
                    <label class="lg-color-channel">
                        <span>色相<output>{Math.round(hsv.hue)}°</output></span>
                        <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={hsv.hue}
                            aria-label="色相"
                            aria-valuetext={`${Math.round(hsv.hue)} 度`}
                            style="--lg-color-track: linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000); --lg-color-thumb: {pureHue}"
                            oninput={(event) => adjust('hue', event.currentTarget.valueAsNumber)}
                        />
                    </label>
                    <label class="lg-color-channel">
                        <span>饱和度<output>{Math.round(hsv.saturation)}%</output></span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={hsv.saturation}
                            aria-label="饱和度"
                            aria-valuetext={`${Math.round(hsv.saturation)}%`}
                            style="--lg-color-track: linear-gradient(to right, {saturationStart}, {saturationEnd}); --lg-color-thumb: {color}"
                            oninput={(event) =>
                                adjust('saturation', event.currentTarget.valueAsNumber)}
                        />
                    </label>
                    <label class="lg-color-channel">
                        <span>亮度<output>{Math.round(hsv.brightness)}%</output></span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={hsv.brightness}
                            aria-label="亮度"
                            aria-valuetext={`${Math.round(hsv.brightness)}%`}
                            style="--lg-color-track: linear-gradient(to right, #000000, {brightnessEnd}); --lg-color-thumb: {color}"
                            oninput={(event) =>
                                adjust('brightness', event.currentTarget.valueAsNumber)}
                        />
                    </label>
                </div>
            </fieldset>
        {/if}
    </div>
    {#if error}<p class="lg-input-error" id={`${prefix}-${node.id}-error`} role="alert">
            {error}
        </p>{/if}
</div>
