<script lang="ts">
    import type { ComponentNode, Dynamic } from '../../protocol/types'
    import { safeMediaUrl } from '../../protocol/media-url'
    import { useRenderer } from '../context'
    import LinguiIcon from '../LinguiIcon.svelte'
    let { node }: { node: ComponentNode } = $props()
    const { state: snapshot, resolve: resolveValue } = useRenderer()
    function resolve(value: Dynamic | undefined) {
        $snapshot
        return resolveValue(value)
    }
    let url = $derived(safeMediaUrl(resolve(node.url)))
    let description = $derived(String(resolve(node.description) ?? ''))
    let failed = $state('')
    let label = $derived(
        node.component === 'Image' ? '图片' : node.component === 'Video' ? '视频' : '音频',
    )
</script>

<figure
    data-lingui-node={node.id}
    class={`lg-media lg-media-${node.component.toLowerCase()} lg-image-${node.variant ?? 'mediumFeature'} lg-image-fit-${node.fit ?? 'cover'}`}
>
    {#if !url || failed === url}
        <div class="lg-media-placeholder" role="status" aria-label={description || label}>
            <LinguiIcon name={node.component === 'Image' ? 'layers' : 'book'} />
            <span>{description || label}</span>
            <span class="lg-caption"
                >{failed === url && url
                    ? `${label}暂时无法加载`
                    : `添加${label}资源后即可预览`}</span
            >
        </div>
    {:else if node.component === 'Image'}
        <img
            src={url}
            alt={description}
            loading="lazy"
            decoding="async"
            crossorigin="anonymous"
            referrerpolicy="no-referrer"
            onerror={() => {
                failed = url!
            }}
        />
    {:else if node.component === 'Video'}
        <!-- svelte-ignore a11y_media_has_caption (captions require a supplied track; native controls remain available) -->
        <video
            src={url}
            controls
            playsinline
            preload="none"
            crossorigin="anonymous"
            aria-label={description || '视频播放器'}
            onerror={() => {
                failed = url!
            }}>当前浏览器无法播放视频。</video
        >
    {:else}
        <audio
            src={url}
            controls
            preload="none"
            crossorigin="anonymous"
            aria-label={description || '音频播放器'}
            onerror={() => {
                failed = url!
            }}>当前浏览器无法播放音频。</audio
        >
    {/if}
    {#if description && url && failed !== url}<figcaption class="lg-caption">
            {description}
        </figcaption>{/if}
</figure>
