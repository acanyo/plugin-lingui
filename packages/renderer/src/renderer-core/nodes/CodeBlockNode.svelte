<script lang="ts">
    import { createNodeMotion } from '../../motion/node'
    import { onDestroy } from 'svelte'
    import type { ComponentNode } from '../../protocol/types'
    let { node }: { node: ComponentNode } = $props()
    let status = $state('')
    let timer: ReturnType<typeof setTimeout> | undefined
    let copying = $state(false)
    async function copy() {
        if (copying) return
        copying = true
        clearTimeout(timer)
        try {
            await navigator.clipboard.writeText(node.code ?? '')
            status = '已复制'
        } catch {
            status = '无法复制，请选择代码复制'
        } finally {
            copying = false
            timer = setTimeout(() => {
                status = ''
            }, 3000)
        }
    }
    onDestroy(() => clearTimeout(timer))
    const { motionEnter, motionExit, motionFeedback } = createNodeMotion()
</script>

<figure
    data-lingui-node={node.id}
    in:motionEnter|global={node.motion?.enter}
    out:motionExit|global={node.motion?.exit}
    use:motionFeedback={node.motion}
    class="lg-code-block"
>
    <figcaption class="lg-code-toolbar">
        <span>{node.label ?? node.language ?? '代码'}</span>
        <button
            type="button"
            class="lg-code-copy"
            onclick={copy}
            disabled={copying}
            aria-label="复制代码"
        >
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                aria-hidden="true"
                ><rect x="8" y="8" width="12" height="12" rx="2" /><path
                    d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"
                /></svg
            >
            {status === '已复制' ? '已复制' : '复制'}
        </button>
    </figcaption>
    <!-- svelte-ignore a11y_no_noninteractive_tabindex (Keyboard users need to focus this region to scroll long code.) -->
    <pre tabindex="0" role="region" aria-label={String(node.label ?? '代码内容')}><code
            >{node.code}</code
        ></pre>
    <span class="lg-sr-only" role="status">{status}</span>
</figure>
