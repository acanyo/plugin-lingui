<script setup lang="ts">
import { ref } from 'vue'
import type { ThemeTokens, FontFamilyDefinition } from '@lingui/renderer'
import ThemeColorField from './ThemeColorField.vue'
import ThemeFontPicker from './ThemeFontPicker.vue'
import { colorFields, shapeFields } from './theme-fields'
const theme = defineModel<ThemeTokens>({ required: true })
defineProps<{ fonts?: FontFamilyDefinition[] }>()
const emit = defineEmits<{ validity: [valid: boolean]; fonts: [] }>()
const invalid = ref(new Set<string>())
function validity(key: string, valid: boolean) {
  if (valid) invalid.value.delete(key)
  else invalid.value.add(key)
  emit('validity', invalid.value.size === 0)
}
function setCustomFont(font: FontFamilyDefinition | undefined) {
  const next = { ...theme.value }
  if (font) next.customFont = font
  else delete next.customFont
  theme.value = next
}
</script>
<template>
  <div class="lu-theme-control-sections">
    <section class="lu-theme-control-section" aria-label="主题信息">
      <h2>主题设置</h2>
      <label class="lu-field"
        ><span>主题名称</span><input v-model="theme.name" maxlength="120"
      /></label>
      <label class="lu-field"
        ><span>明暗模式</span
        ><select v-model="theme.mode">
          <option value="light">浅色</option>
          <option value="dark">深色</option>
          <option value="auto">跟随 Halo / 系统</option>
        </select></label
      >
      <p v-if="theme.mode === 'auto'" class="lu-muted">
        明暗配色根据当前主题生成，保留强调色倾向。
      </p>
    </section>
    <section class="lu-theme-control-section" aria-label="主题配色">
      <h2>颜色</h2>
      <p class="lu-muted">页面、表面和强调色共同决定组件的层次。</p>
      <ThemeColorField
        v-for="field in colorFields"
        :key="field.key"
        v-model="theme.colors[field.key]"
        :label="field.label"
        @validity="validity(field.key, $event)"
      />
    </section>
    <section class="lu-theme-control-section" aria-label="主题形状与排版">
      <h2>形状与排版</h2>
      <label v-for="field in shapeFields" :key="field.key" class="lu-theme-slider">
        <span
          >{{ field.label
          }}<output
            >{{ theme[field.key] }} <small>{{ field.unit }}</small></output
          ></span
        >
        <input
          v-model.number="theme[field.key]"
          type="range"
          :min="field.min"
          :max="field.max"
          step="1"
          :aria-label="field.label"
        />
      </label>
      <ThemeFontPicker
        v-model="theme.font"
        :custom-font="theme.customFont"
        :fonts="fonts"
        @update:custom-font="setCustomFont"
        @manage="emit('fonts')"
      />
    </section>
  </div>
</template>
