<script lang="ts">
    import type { ComponentNode } from '../../protocol/types'
    import { safeMediaUrl } from '../../protocol/media-url'
    let { node }: { node: ComponentNode } = $props()
    let failed = $state<string[]>([])
    let members = $derived(node.members ?? []),
        limit = $derived(node.maxVisible ?? 4)
</script>

<div data-lingui-node={node.id} class="lg-avatar-group">
    <span class="lg-caption">{node.label}</span>
    <div
        class="lg-avatar-stack"
        role="img"
        aria-label={members.map((member) => member.label).join('、')}
    >
        {#each members.slice(0, limit) as member}<span class="lg-group-avatar" title={member.label}
                >{#if safeMediaUrl(member.url) && !failed.includes(member.url!)}<img
                        src={safeMediaUrl(member.url)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        crossorigin="anonymous"
                        referrerpolicy="no-referrer"
                        onerror={() => (failed = [...failed, member.url!])}
                    />{:else}<span>{Array.from(member.label).slice(0, 2).join('')}</span>{/if}</span
            >{/each}
        {#if members.length > limit}<span
                class="lg-group-avatar lg-avatar-overflow"
                aria-hidden="true">+{members.length - limit}</span
            >{/if}
    </div>
    <span class="lg-caption">{members.length} 位成员</span>
</div>
