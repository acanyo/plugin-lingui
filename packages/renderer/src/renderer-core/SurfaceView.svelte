<script lang="ts">
    import type { ComponentInstance } from '../protocol/types'
    import { resolveDocument } from '../protocol/validate'
    import { parameterState } from '../protocol/instance'
    import { createRuntime } from '../interaction-runtime/runtime'
    import { onDestroy, onMount } from 'svelte'
    import { createEventRuntime } from '../events/runtime'
    import type { InteractionHost } from '../events/types'
    import { attachDomEvents } from '../events/dom'
    import {
        registeredInteractionCallbacks,
        registeredInteractionRequests,
    } from '../events/registry'
    import { tokenStyle } from '../theme-core/tokens'
    import { provideRenderer } from './context'
    import { Renderer } from '@openuidev/svelte-lang'
    import { openuiLibrary } from '../openui/library'
    let {
        instance,
        hostDark = false,
        interactions = {},
    }: {
        instance: ComponentInstance
        hostDark?: boolean
        interactions?: InteractionHost
    } = $props()
    const initial = (() => instance)()
    const surface = resolveDocument(initial.document)
    const runtime = createRuntime(parameterState(initial))
    let error = $state('')
    const report = (cause: unknown) => {
        // A derived expression can fail while Svelte is rendering. Commit feedback afterwards.
        const message = cause instanceof Error ? cause.message : '组件暂时无法交互'
        queueMicrotask(() => {
            error = message
        })
    }
    const id = $props.id()
    const eventRuntime = createEventRuntime(
        runtime,
        {
            get trace() {
                return interactions.trace
            },
            get apis() {
                return {
                    ...Object.fromEntries(
                        (initial.document.integrations?.apis ?? []).map((api) => [api.name, api]),
                    ),
                    ...interactions.apis,
                }
            },
            get callbacks() {
                return {
                    ...(interactions.inheritRegistered === false
                        ? {}
                        : registeredInteractionCallbacks()),
                    ...interactions.callbacks,
                }
            },
            get requests() {
                return (
                    interactions.requests ??
                    (interactions.inheritRegistered === false
                        ? undefined
                        : registeredInteractionRequests())
                )
            },
            onEvent: (value) => {
                if (value.phase === 'start')
                    queueMicrotask(() => {
                        error = ''
                    })
                interactions.onEvent?.(value)
            },
        },
        report,
    )
    provideRenderer(
        surface,
        runtime,
        `lg-${id}`,
        report,
        eventRuntime,
        () => interactions.motion !== false,
    )
    onMount(() => {
        if (interactions.autoStart === false) return
        for (const node of Object.values(surface.nodes)) {
            if (node.events?.mount) void eventRuntime.fire(node, 'mount')
        }
    })
    onDestroy(() => eventRuntime.destroy())
    let style = $derived(
        Object.entries(tokenStyle(instance.theme))
            .map(([key, value]) => `${key === 'colorScheme' ? 'color-scheme' : key}:${value}`)
            .join(';'),
    )
</script>

<div class="lingui-container">
    <section
        class="lingui-surface"
        data-mode={instance.theme.mode}
        data-host-dark={hostDark}
        {style}
        aria-label={instance.document.title}
        use:attachDomEvents={{ surface, runtime, events: eventRuntime }}
    >
        <Renderer response={instance.document.source} library={openuiLibrary} />{#if error}<p
                class="lg-error"
                role="alert"
            >
                {error}
                <button
                    type="button"
                    onclick={() => {
                        runtime.reset()
                        error = ''
                    }}>重置组件</button
                >
            </p>{/if}
    </section>
</div>
