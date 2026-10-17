<script setup lang="ts">
import SourceAttribution from '../remix/SourceAttribution.vue'
import RecordingReplay from '../interaction-recordings/RecordingReplay.vue'
import { sharedRecording } from '../interaction-recordings/shared-demo'
import DependencySummary from '../integrations/DependencySummary.vue'
import ApiContractSummary from '../integrations/ApiContractSummary.vue'
import { computed } from 'vue'
import { VButton } from '@halo-dev/components'
import VModal from '../shared/StudioModal.vue'
import { resolveDocument } from '@lingui/renderer'
import { workInstance, type MarketplaceWork } from './catalog'
import MarketPreview from './MarketPreview.vue'
import { marketName } from './market-service'
import LinguiIcon from '../shared/LinguiIcon.vue'
const props = defineProps<{ work: MarketplaceWork; download?: boolean; actionDisabled?: boolean }>()
defineEmits<{ back: []; use: [id: string] }>()
const instance = computed(() => workInstance(props.work))
const nodeCount = computed(() => Object.keys(resolveDocument(instance.value.document).nodes).length)
</script>
<template>
  <VModal title="作品详情" :width="1120" @close="$emit('back')">
    <section class="lingui-studio lu-work-detail">
      <div class="lu-detail-layout">
        <MarketPreview :instance="instance" :theme="work.kind === 'theme'" />
        <aside class="lu-work-info">
          <span class="lu-eyebrow">{{ work.kind === 'theme' ? '主题' : work.category }}</span>
          <h2>{{ work.title }}</h2>
          <p>{{ work.description }}</p>
          <div class="lu-publisher">
            <span class="lu-publisher-mark"
              ><LinguiIcon :name="work.kind === 'theme' ? 'palette' : 'layers'"
            /></span>
            <div>
              {{ work.publisher
              }}<small>{{
                work.source === 'community' ? `社区作品 · v${work.version}` : '内置作品'
              }}</small>
            </div>
          </div>
          <dl v-if="work.kind === 'theme'" class="lu-work-facts">
            <div>
              <dt>明暗模式</dt>
              <dd>
                {{
                  instance.theme.mode === 'dark'
                    ? '深色'
                    : instance.theme.mode === 'auto'
                      ? '跟随系统'
                      : '浅色'
                }}
              </dd>
            </div>
            <div>
              <dt>字体</dt>
              <dd>
                {{
                  instance.theme.customFont?.name ||
                  (instance.theme.font === 'serif'
                    ? '衬线 / 宋体'
                    : instance.theme.font === 'mono'
                      ? '等宽'
                      : '系统无衬线')
                }}
              </dd>
            </div>
            <div>
              <dt>圆角 / 间距</dt>
              <dd>{{ instance.theme.radius }} / {{ instance.theme.spacing }} px</dd>
            </div>
            <div>
              <dt>许可证</dt>
              <dd>{{ work.license }}</dd>
            </div>
          </dl>
          <dl v-else class="lu-work-facts">
            <div>
              <dt>组件节点</dt>
              <dd>{{ nodeCount }} 个</dd>
            </div>
            <div>
              <dt>可配置参数</dt>
              <dd>{{ instance.document.parameters.length }} 个</dd>
            </div>
            <div>
              <dt>作品来源</dt>
              <dd>{{ work.source === 'community' ? marketName : '随插件内置' }}</dd>
            </div>
            <div>
              <dt>许可证</dt>
              <dd>{{ work.license }}</dd>
            </div>
          </dl>
          <SourceAttribution :sources="work.provenance" />
          <p class="lu-muted">
            改编需保留署名与许可证；保留所有权利或未注明许可的作品请先取得授权。
          </p>
          <DependencySummary :instance="instance" />
          <ApiContractSummary :apis="instance.document.integrations?.apis ?? []" />
          <div class="lu-detail-note">
            <LinguiIcon name="code" />
            <p>
              {{
                work.kind === 'theme'
                  ? '加入我的主题后，可在工作台继续调整，并用于自己的组件。'
                  : '支持可视化编辑和 JSON 导出，下载到我的项目后可插入 Halo 文章。'
              }}
            </p>
          </div>
        </aside>
      </div>
      <details v-for="(demo, index) in work.demos" :key="index">
        <summary>演示：{{ demo.name }}</summary>
        <RecordingReplay :recording="sharedRecording(demo, instance)" />
      </details>
    </section>
    <template #footer>
      <div class="lingui-studio lu-dialog-actions">
        <span class="lu-detail-save-hint">{{
          download
            ? '先下载到我的项目，再选择插入文章'
            : work.kind === 'theme'
              ? '保存为独立副本，保留已有主题'
              : '保存后才会加入项目列表'
        }}</span>
        <VButton class="lu-button" @click="$emit('back')">关闭预览</VButton>
        <VButton
          type="secondary"
          class="lu-button primary"
          :disabled="
            actionDisabled ||
            (work.kind !== 'theme' && !['MIT', 'Apache-2.0', 'GPL-3.0'].includes(work.license))
          "
          @click="$emit('use', work.id)"
          >{{
            download ? '下载到我的项目' : work.kind === 'theme' ? '加入我的主题' : '基于此作品创作'
          }}
          <LinguiIcon name="arrow"
        /></VButton>
      </div>
    </template>
  </VModal>
</template>
