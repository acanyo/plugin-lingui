<script setup lang="ts">
import { computed } from 'vue'
import type { ComponentNode, NodeMotion, MotionTiming, MotionEasing } from '@lingui/renderer'
const props = defineProps<{ node: ComponentNode }>()
const emit = defineEmits<{ update: [node: ComponentNode] }>()
type Channel = Exclude<keyof NodeMotion, 'transition'>
const appearance = [
  ['fade', '淡入淡出'],
  ['fade-up', '淡入上移'],
  ['fade-down', '淡入下移'],
  ['zoom', '缩放出现'],
]
const feedback = [
  ['lift', '轻微抬升'],
  ['grow', '轻微放大'],
]
const channels: Array<{ key: Channel; label: string; presets: string[][] }> = [
  { key: 'enter', label: '入场', presets: appearance },
  { key: 'exit', label: '离场', presets: appearance },
  { key: 'hover', label: '悬停', presets: feedback },
  { key: 'press', label: '按下', presets: [['scale-down', '轻微缩小']] },
  { key: 'focus', label: '聚焦', presets: feedback },
]
const transitionSupported = computed(() =>
  ['LingUI.Collapse', 'LingUI.Accordion', 'Tabs', 'LingUI.Tabs'].includes(props.node.component),
)
const easings: Array<[MotionEasing, string]> = [
  ['ease-out', '柔和结束'],
  ['ease-in-out', '柔和开始和结束'],
  ['ease-in', '柔和开始'],
  ['linear', '匀速'],
  ['ease', '平滑'],
]
function save(motion: NodeMotion) {
  const next = { ...props.node }
  if (Object.keys(motion).length) next.motion = motion
  else delete next.motion
  emit('update', next)
}
function preset(channel: Channel, value: string) {
  const motion = { ...props.node.motion }
  if (value) Object.assign(motion, { [channel]: { ...motion[channel], preset: value } })
  else delete motion[channel]
  save(motion)
}
function timing(channel: keyof NodeMotion, field: keyof MotionTiming | 'delay', value: string) {
  const previous = props.node.motion?.[channel]
  if (!previous) return
  const parsed = field === 'easing' ? value : Number(value)
  if (typeof parsed === 'number' && (!Number.isInteger(parsed) || parsed < 0 || parsed > 2000))
    return
  save({ ...props.node.motion, [channel]: { ...previous, [field]: parsed } })
}
function transition(enabled: boolean) {
  const motion = { ...props.node.motion }
  if (enabled) motion.transition = { duration: 240 }
  else delete motion.transition
  save(motion)
}
</script>
<template>
  <details class="lu-advanced">
    <summary>交互动画{{ node.motion ? ' · 已配置' : '' }}</summary>
    <section aria-label="交互动画配置">
      <div v-for="channel in channels" :key="channel.key">
        <label class="lu-field">
          <span>{{ channel.label }}动画</span>
          <select
            :value="node.motion?.[channel.key]?.preset ?? ''"
            :aria-label="`${channel.label}动画`"
            @change="preset(channel.key, ($event.target as HTMLSelectElement).value)"
          >
            <option value="">无动画</option>
            <option v-for="[value, label] in channel.presets" :key="value" :value="value">
              {{ label }}
            </option>
          </select>
        </label>
        <template v-if="node.motion?.[channel.key]">
          <label class="lu-field"
            ><span>{{ channel.label }}时长（毫秒）</span
            ><input
              type="number"
              min="0"
              max="2000"
              step="10"
              :aria-label="`${channel.label}时长`"
              :value="
                node.motion[channel.key]?.duration ??
                (channel.key === 'press'
                  ? 100
                  : ['hover', 'focus'].includes(channel.key)
                    ? 160
                    : 240)
              "
              @change="timing(channel.key, 'duration', ($event.target as HTMLInputElement).value)"
          /></label>
          <label v-if="['enter', 'exit'].includes(channel.key)" class="lu-field"
            ><span>{{ channel.label }}延迟（毫秒）</span
            ><input
              type="number"
              min="0"
              max="2000"
              step="10"
              :aria-label="`${channel.label}延迟`"
              :value="(node.motion[channel.key] as NodeMotion['enter'])?.delay ?? 0"
              @change="timing(channel.key, 'delay', ($event.target as HTMLInputElement).value)"
          /></label>
          <label class="lu-field"
            ><span>{{ channel.label }}节奏</span
            ><select
              :value="node.motion[channel.key]?.easing ?? 'ease-out'"
              :aria-label="`${channel.label}节奏`"
              @change="timing(channel.key, 'easing', ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="[value, label] in easings" :key="value" :value="value">
                {{ label }}
              </option>
            </select></label
          >
        </template>
      </div>
      <template v-if="transitionSupported">
        <label class="lu-check"
          ><input
            type="checkbox"
            :checked="Boolean(node.motion?.transition)"
            @change="transition(($event.target as HTMLInputElement).checked)"
          />平滑切换内容</label
        >
        <label v-if="node.motion?.transition" class="lu-field"
          ><span>切换时长（毫秒）</span
          ><input
            type="number"
            min="0"
            max="2000"
            step="10"
            aria-label="切换时长"
            :value="node.motion.transition.duration ?? 240"
            @change="timing('transition', 'duration', ($event.target as HTMLInputElement).value)"
        /></label>
      </template>
      <p class="lu-muted">
        入场与离场跟随节点出现和移除。悬停适用于鼠标，聚焦支持键盘操作；系统开启减少动态效果时自动停用动画。
      </p>
    </section>
  </details>
</template>
