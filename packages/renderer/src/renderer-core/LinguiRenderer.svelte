<script lang="ts">
    import type { ComponentInstance } from '../protocol/types'
    import { validateInstance } from '../protocol/instance'
    import SurfaceView from './SurfaceView.svelte'
    import type { InteractionHost } from '../events/types'
    let {
        instance,
        hostDark = false,
        interactions = {},
    }: {
        instance: ComponentInstance
        hostDark?: boolean
        interactions?: InteractionHost
    } = $props()
    let validated = $derived.by(() => {
        try {
            return { instance: validateInstance(instance), error: '' }
        } catch (error) {
            return {
                instance: undefined,
                error: error instanceof Error ? error.message : '组件数据无效',
            }
        }
    })
    let key = $derived(
        JSON.stringify([validated.instance?.document, validated.instance?.parameters]),
    )
</script>

{#if validated.instance}{#key key}<SurfaceView
            instance={validated.instance}
            {hostDark}
            {interactions}
        />{/key}{:else}<p role="alert">此组件暂时无法展示：{validated.error}</p>{/if}
