<script setup lang="ts">
import { runInteractionCheck } from '../interaction-check/run'
import ArticleSourcePanel from '../article-transform/ArticleSourcePanel.vue'
import type { ArticleSource } from '../article-transform/source'
import SourceAttribution from '../remix/SourceAttribution.vue'
import { validateSources, type WorkSource } from '../remix/provenance'
import { createSubmission } from '../marketplace/submission'
import type { CandidateSet } from '../design-candidates/model'
import type { InteractionRecording } from '../interaction-recordings/model'
import DependencyMappingDialog from '../integrations/DependencyMappingDialog.vue'
import { workDependencies } from '@lingui/renderer'
import { cloneJson } from '../shared/clone'
import type { GeneratedDesign } from '../ai-adapter/design-result'
import { useWorkRevisions } from '../revisions/useWorkRevisions'
import type { ConversationState } from '../ai-adapter/conversation'
import CreationHistoryDialog from '../creation-history/CreationHistoryDialog.vue'
import {
  creationTitle,
  type CreationRecord,
  type CreationSnapshot,
  type CreationOrigin,
} from '../creation-history/types'
import { useCreationHistory } from '../creation-history/useCreationHistory'
import { useHistoryScope } from '../creation-history/history-scope'

import StudioNavigation, { type StudioSection } from '../workspace/StudioNavigation.vue'
import MarketplaceView from '../marketplace/MarketplaceView.vue'
import SubmissionWorkspace from '../marketplace/SubmissionWorkspace.vue'
import { projectSubmission } from '../marketplace/project-submission'
import { copyMarketTheme, themeSubmission } from '../marketplace/theme-submission'
import type { SubmissionDraft } from '../marketplace/submission'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { Dialog, Toast } from '@halo-dev/components'
import {
  builtInThemes,
  createInstance,
  examples,
  pureTheme,
  validateDocument,
  validateInstance,
  type ComponentInstance,
  type LinguiDocument,
  type ThemeTokens,
} from '@lingui/renderer'
import ComponentLibrary from '../component-library/ComponentLibrary.vue'
import CatalogView from '../component-studio/CatalogView.vue'
import CreationWorkspace from '../workspace/CreationWorkspace.vue'
import { createBlankDocument, updateInstanceDocument } from '../component-studio/document-editor'
import ThemeStudio from '../theme-studio/ThemeStudio.vue'
import FontManagerView from '../font-library/FontManagerView.vue'
import McpManagementView from '../mcp/McpManagementView.vue'
import ImportDialog from '../shared/ImportDialog.vue'
import SaveTemplateDialog from '../component-library/SaveTemplateDialog.vue'
import { templateInstance, type TemplateRecord } from '../component-library/types'
import { useRepository, errorMessage } from '../services/repository'
import { downloadJson } from '../shared/download'
import '../shared/studio.css'
import { useStudioAccess } from '../services/studio-access'
import { useMcpInbox } from '../mcp/history/useMcpInbox'
import McpInboxDialog from '../mcp/history/McpInboxDialog.vue'
import { reviewDraft, type DraftReview } from '../mcp/history/review'
import { applyDraftSelection, type DraftSelection } from '../mcp/history/changes'
const props = defineProps<{
  initialInstance?: ComponentInstance
  projectId?: string
  embedding?: boolean
  article?: { source: ArticleSource; prompt: string }
}>()
const emit = defineEmits<{
  insert: [instance: ComponentInstance, source?: ArticleSource, provenance?: WorkSource[]]
  close: []
}>()
const repository = useRepository(),
  tab = ref<StudioSection>('components'),
  draftSource = ref<ComponentInstance>(),
  projectDraft = ref<SubmissionDraft>(),
  session = ref(0),
  templates = shallowRef<TemplateRecord[]>([]),
  customThemes = ref<ThemeTokens[]>([]),
  loading = ref(true),
  error = ref(''),
  active = shallowRef<ComponentInstance | undefined>(
    props.initialInstance ? validateInstance(props.initialInstance) : undefined,
  ),
  activeTemplate = shallowRef<TemplateRecord>(),
  showImport = ref(false),
  showSave = ref(false),
  saving = ref(false),
  saveError = ref(''),
  aiBusy = ref(false),
  startEditing = ref(false),
  pendingAi = shallowRef<GeneratedDesign>(),
  dirty = ref(false),
  renaming = ref(false)
const articleSource = shallowRef<ArticleSource | undefined>(props.article?.source)
const articleReviewed = ref(false),
  checkingArticle = ref(false)
const provenance = shallowRef<WorkSource[]>([])
const pendingSources = shallowRef<WorkSource[]>([])
const candidates = shallowRef<CandidateSet>()
const recordings = shallowRef<InteractionRecording[]>([])
watch(active, () => {
  articleReviewed.value = false
})
const conversation = shallowRef<ConversationState>({
  messages: [],
  instruction: props.article?.prompt ?? '',
})
const access = useStudioAccess()
const canUseExternalDrafts = () => repository.mode === 'halo' && access.allows('mcp:use')
const mcpInbox = useMcpInbox(canUseExternalDrafts)
const loadingExternalDraft = ref(false)
const externalDraftError = ref('')
async function reviewExternalDraft(id: string) {
  const [detail, projects] = await Promise.all([
    mcpInbox.client.get(id),
    repository.listTemplates(),
  ])
  return reviewDraft(detail, projects, active.value)
}
async function applyExternalDraft(
  selected: DraftReview,
  asNew: boolean,
  selection?: DraftSelection,
) {
  if (
    aiBusy.value ||
    saving.value ||
    changingCreation.value ||
    loadingExternalDraft.value ||
    pendingAi.value
  ) {
    Toast.info('请先完成当前创作或处理 AI 修改冲突，再载入外部草稿。')
    return
  }
  loadingExternalDraft.value = true
  externalDraftError.value = ''
  try {
    const id = selected.info.id!
    const [detail, projects] = await Promise.all([
      mcpInbox.client.get(id),
      repository.listTemplates(),
    ])
    const review = reviewDraft(detail, projects, active.value)
    if (!asNew && review.conflict && !review.merge) throw new Error(review.conflict)
    if (!asNew && review.merge) {
      if (!selection) throw new Error('请先逐项审核本次修改。')
      review.instance = applyDraftSelection(review.merge, selection)
    }
    await replaceCreation(() => {
      if (review.theme) {
        // Give external themes their own identity; importing must not overwrite a saved theme.
        marketTheme.value = { ...cloneJson(review.theme), id: `theme-${crypto.randomUUID()}` }
        tab.value = 'themes'
      } else if (review.instance) {
        const target =
          !asNew && review.info.workName
            ? projects.find((project) => project.id === review.info.workName)
            : undefined
        if (target && active.value?.templateId === target.id) {
          activeTemplate.value = target
          revisions.commit(
            validateInstance(cloneJson(review.instance)),
            `外部 AI：${review.info.title}`,
          )
        } else {
          resetCreation('import')
          const instance = validateInstance(cloneJson(review.instance))
          if (target) {
            activeTemplate.value = target
            provenance.value = cloneJson(target.revisions.at(-1)?.provenance ?? [])
            const baseline = templateInstance(target, pureTheme)
            active.value = baseline
            revisions.commit(
              { ...instance, templateId: target.id, templateVersion: baseline.templateVersion },
              `外部 AI：${review.info.title}`,
            )
          } else {
            delete instance.templateId
            delete instance.templateVersion
            revisions.commit(instance, `外部 AI：${review.info.title}`)
          }
        }
        dirty.value = true
        startEditing.value = false
        tab.value = 'components'
      }
      mcpInbox.open.value = false
      // Acknowledgement describes loading only; the existing Save action remains explicit.
      void mcpInbox.client
        .loaded(id)
        .then(() => mcpInbox.refresh())
        .catch(() => {
          Toast.info('草稿已载入，但已载入标记未同步，可在列表中刷新重试。')
        })
      Toast.success('草稿已载入，检查交互后可手动保存。')
    })
  } catch (cause) {
    externalDraftError.value = errorMessage(cause)
  } finally {
    loadingExternalDraft.value = false
  }
}
const showHistory = ref(false)
const dependencyImport = shallowRef<ComponentInstance>()
const marketTheme = shallowRef<ThemeTokens>()
const importingTheme = ref(false)
const changingCreation = ref(false)
const restoredProject = ref<CreationSnapshot['project']>()
const revisions = useWorkRevisions(
  () => active.value,
  (instance) => {
    active.value = instance
    dirty.value = true
  },
)
const history = useCreationHistory(
  useHistoryScope(repository.mode),
  () => ({
    ...(active.value ? { instance: active.value } : {}),
    ...conversation.value,
    recordings: recordings.value,
    ...(articleSource.value ? { articleSource: articleSource.value } : {}),
    provenance: provenance.value,
    ...(candidates.value ? { candidates: candidates.value } : {}),
    ...(revisions.history.value ? { workRevisions: revisions.history.value } : {}),
    dirty: dirty.value,
    editing: startEditing.value,
    ...(activeTemplate.value
      ? {
          project: { id: activeTemplate.value.id, versionToken: activeTemplate.value.versionToken },
        }
      : restoredProject.value
        ? { project: restoredProject.value }
        : {}),
    ...(pendingAi.value ? { pendingAi: pendingAi.value } : {}),
  }),
  restoreCreation,
  {
    autoResume: !props.embedding && !props.initialInstance && !props.projectId,
    origin: props.initialInstance || props.article ? 'article' : 'ai',
  },
)

function restoreCreation(value: CreationSnapshot) {
  session.value++
  articleSource.value = value.articleSource
  articleReviewed.value = false
  provenance.value = value.provenance ?? []
  candidates.value = value.candidates
  recordings.value = value.recordings ?? []
  active.value = value.instance
  revisions.reset(value.workRevisions)
  conversation.value = { messages: value.messages, instruction: value.instruction }
  dirty.value = value.dirty
  startEditing.value = value.editing
  pendingAi.value = value.pendingAi
  restoredProject.value = value.project
  activeTemplate.value = undefined
  aiBusy.value = false
  tab.value = 'components'
  if (!loading.value) syncRestoredProject()
}
function syncRestoredProject() {
  if (!restoredProject.value) return
  const reference = restoredProject.value
  const project = templates.value.find((item) => item.id === reference.id)
  if (project) {
    activeTemplate.value = project
    if (project.versionToken !== reference.versionToken)
      Toast.info('项目已有更新，历史作品保存时会追加为新版本')
  } else if (active.value) {
    active.value = { ...active.value, templateId: undefined, templateVersion: undefined }
    dirty.value = true
    Toast.info('原项目已删除，历史作品可保存为新项目')
  }
  restoredProject.value = undefined
}
async function openHistory() {
  showHistory.value = true
  await history.refresh()
}
async function resumeHistory(record: CreationRecord) {
  if (aiBusy.value || saving.value || changingCreation.value) return
  changingCreation.value = true
  try {
    await history.activate(record)
    showHistory.value = false
  } catch (cause) {
    Toast.error(errorMessage(cause))
  } finally {
    changingCreation.value = false
  }
}
function removeHistory(record: CreationRecord) {
  if (aiBusy.value || saving.value) return
  Dialog.warning({
    title: `删除历史“${creationTitle(record)}”？`,
    description: '这段对话和历史草稿将被删除。已保存的项目保留；删除当前历史会同时关闭当前创作。',
    confirmText: '删除历史',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await history.flush()
        await history.remove(record)
        if (history.activeId.value === record.id) resetCreation()
      } catch (cause) {
        Toast.error(errorMessage(cause))
      }
    },
  })
}
const themes = computed(() => [
  ...new Map(
    [...builtInThemes, ...customThemes.value, ...(active.value ? [active.value.theme] : [])].map(
      (theme) => [theme.id, theme],
    ),
  ).values(),
])
let projectsLoaded = false
async function refresh() {
  loading.value = true
  projectsLoaded = false
  try {
    const [components, designs] = await Promise.all([
      repository.listTemplates(),
      repository.listThemes(),
    ])
    templates.value = components
    projectsLoaded = true
    customThemes.value = designs
    syncRestoredProject()
    error.value = ''
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)
let openedProject = ''
watch(
  () => [props.projectId, loading.value, history.loading.value] as const,
  async ([id, fetching, restoring]) => {
    if (!id) {
      openedProject = ''
      return
    }
    if (fetching || restoring || !projectsLoaded || openedProject === id) return
    const project = templates.value.find((item) => item.id === id)
    if (!project) {
      error.value = '该项目不存在或已被删除，请在我的项目中重新选择。'
      tab.value = 'projects'
      return
    }
    openedProject = id
    error.value = ''
    await openTemplate(project)
    if (activeTemplate.value?.id === id) startEditing.value = true
  },
)
function resetCreation(origin: CreationOrigin = 'ai') {
  articleSource.value = undefined
  articleReviewed.value = false
  provenance.value = []
  candidates.value = undefined
  recordings.value = []
  history.start(origin)
  revisions.reset()
  session.value++
  aiBusy.value = false
  pendingAi.value = undefined
  startEditing.value = false
  active.value = undefined
  activeTemplate.value = undefined
  dirty.value = false
  showSave.value = false
  saveError.value = ''
  renaming.value = false
  conversation.value = { messages: [], instruction: '' }
  restoredProject.value = undefined
  tab.value = 'components'
}
async function replaceCreation(action: () => void) {
  if (changingCreation.value) return
  if (aiBusy.value || saving.value) {
    Toast.info('AI 正在创作，请完成后再打开其他作品')
    return
  }
  try {
    changingCreation.value = true
    await history.flush()
    action()
    return
  } catch {
    /* If local history is unavailable, keep the original unsaved-work guard. */
  } finally {
    changingCreation.value = false
  }
  if (
    (active.value && dirty.value) ||
    conversation.value.messages.length ||
    conversation.value.instruction.trim()
  )
    Dialog.warning({
      title: '开始新的创作？',
      description: '创作历史未能保存。继续会丢弃当前对话和未保存的修改，请先重试保存历史。',
      confirmText: '继续',
      cancelText: '返回创作',
      onConfirm: action,
    })
  else action()
}
function newConversation() {
  void replaceCreation(() => {
    resetCreation()
    showHistory.value = false
  })
}
function createBlank() {
  replaceCreation(() => {
    resetCreation('blank')
    active.value = createInstance(createBlankDocument())
    startEditing.value = true
    dirty.value = true
  })
}
function openTemplate(template: TemplateRecord, version?: number, editMetadata = false) {
  return replaceCreation(() => {
    resetCreation('project')
    const instance = templateInstance(template, pureTheme)
    if (version) {
      const revision = template.revisions.find((revision) => revision.version === version)!
      instance.document = cloneJson(revision.document)
      instance.theme = cloneJson(revision.theme ?? pureTheme)
      instance.parameters = Object.fromEntries(
        instance.document.parameters.map((parameter) => [parameter.key, parameter.default]),
      )
      instance.templateVersion = version
    }
    provenance.value = validateSources(
      template.revisions.find((row) => row.version === instance.templateVersion)?.provenance ?? [],
    )
    active.value = instance
    activeTemplate.value = template
    if (editMetadata) {
      renaming.value = true
      saveError.value = ''
      showSave.value = true
    }
  })
}
function update(instance: ComponentInstance) {
  revisions.commit(instance, '手动修改')
}
function undo() {
  if (!aiBusy.value && !pendingAi.value) revisions.undo()
}
function redo() {
  if (!aiBusy.value && !pendingAi.value) revisions.redo()
}
function restoreRevision(id: string) {
  if (!aiBusy.value && !pendingAi.value) revisions.restore(id)
}
function openSaveDialog() {
  renaming.value = false
  saveError.value = ''
  showSave.value = true
}
function imported(document: LinguiDocument, suppliedTheme?: ThemeTokens) {
  replaceCreation(() => {
    const theme = suppliedTheme ?? active.value?.theme ?? pureTheme
    resetCreation('import')
    active.value = createInstance(document, theme)
    showImport.value = false
    dirty.value = true
  })
}
async function save(name: string, category: string, description: string) {
  if (!active.value || saving.value) return
  saving.value = true
  saveError.value = ''
  try {
    if (restoredProject.value && !activeTemplate.value)
      throw new Error('项目数据尚未载入，请刷新项目列表后再保存')
    const previous = activeTemplate.value
    const document = validateDocument({ ...active.value.document, title: name })
    const record: TemplateRecord = {
      id: previous?.id ?? `component-${crypto.randomUUID()}`,
      name,
      category,
      description,
      ...(previous?.versionToken !== undefined ? { versionToken: previous.versionToken } : {}),
      revisions:
        renaming.value && previous
          ? previous.revisions
          : [
              ...(previous?.revisions ?? []),
              {
                version: (previous?.revisions.at(-1)?.version ?? 0) + 1,
                createdAt: new Date().toISOString(),
                document,
                theme: cloneJson(active.value.theme),
                ...(provenance.value.length ? { provenance: cloneJson(provenance.value) } : {}),
              },
            ].slice(-20),
    }
    const saved = await repository.saveTemplate(record)
    activeTemplate.value = saved
    active.value = {
      ...active.value,
      document,
      templateId: saved.id,
      templateVersion: saved.revisions.at(-1)!.version,
    }
    dirty.value = false
    showSave.value = false
    renaming.value = false
    await refresh()
    Toast.success('组件已保存，文章与主题中的引用将在刷新后更新')
  } catch (cause) {
    saveError.value = errorMessage(cause)
  } finally {
    saving.value = false
  }
}
async function duplicate(template: TemplateRecord) {
  try {
    const record: TemplateRecord = {
      ...template,
      id: `component-${crypto.randomUUID()}`,
      name: `${template.name} 副本`,
      versionToken: undefined,
      revisions: [
        {
          version: 1,
          createdAt: new Date().toISOString(),
          document: validateDocument({
            ...template.revisions.at(-1)!.document,
            title: `${template.name} 副本`,
          }),
          ...(template.revisions.at(-1)!.theme
            ? { theme: cloneJson(template.revisions.at(-1)!.theme) }
            : {}),
        },
      ],
    }
    await repository.saveTemplate(record)
    await refresh()
    Toast.success('组件已复制')
  } catch (cause) {
    error.value = errorMessage(cause)
  }
}
function remove(template: TemplateRecord) {
  Dialog.warning({
    title: `删除项目“${template.name}”？`,
    description: '该项目及其全部版本将被删除，无法撤销。文章与主题中引用此项目的组件将无法加载。',
    confirmText: '删除项目',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await repository.deleteTemplate(template.id)
        if (activeTemplate.value?.id === template.id) {
          resetCreation()
          tab.value = 'projects'
        }
        await refresh()
        Toast.success('项目已删除')
      } catch (cause) {
        error.value = errorMessage(cause)
      }
    },
  })
}
function rename(template: TemplateRecord) {
  openTemplate(template, undefined, true)
}
async function saveTheme(theme: ThemeTokens) {
  try {
    await repository.saveTheme(theme)
    await refresh()
    Toast.success('主题已保存')
  } catch (cause) {
    error.value = errorMessage(cause)
  }
}
async function useMarketTheme(theme: ThemeTokens) {
  if (importingTheme.value) return
  importingTheme.value = true
  try {
    const copy = copyMarketTheme(theme)
    await repository.saveTheme(copy)
    customThemes.value = [...customThemes.value, copy]
    marketTheme.value = copy
    tab.value = 'themes'
    Toast.success('已加入我的主题')
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    importingTheme.value = false
  }
}
function prepareThemeSubmission(theme: ThemeTokens) {
  draftSource.value = undefined
  projectDraft.value = themeSubmission(theme)
  tab.value = 'drafts'
}
function deleteTheme(theme: ThemeTokens) {
  Dialog.warning({
    title: `删除“${theme.name}”？`,
    description:
      '项目已保存的主题不受影响；在项目中更换主题并保存后，文章与主题中的组件引用随之更新。',
    confirmText: '删除主题',
    cancelText: '取消',
    onConfirm: async () => {
      try {
        await repository.deleteTheme(theme.id)
        await refresh()
        Toast.success('主题已删除')
      } catch (cause) {
        error.value = errorMessage(cause)
      }
    },
  })
}
function applyAi(document: LinguiDocument, theme?: ThemeTokens) {
  let next = active.value
    ? updateInstanceDocument(active.value, document)
    : createInstance(document)
  if (theme) next = validateInstance({ ...next, theme })
  revisions.commit(
    next,
    `AI：${conversation.value.messages.filter((message) => message.role === 'user').at(-1)?.text ?? document.title}`,
  )
  pendingAi.value = undefined
}
function generated(document: LinguiDocument, source?: ComponentInstance, theme?: ThemeTokens) {
  if (JSON.stringify(active.value) !== JSON.stringify(source)) {
    pendingAi.value = { document, ...(theme ? { theme } : {}) }
    return
  }
  applyAi(document, theme)
}
function resolveAi(useGenerated: boolean) {
  if (useGenerated && pendingAi.value) applyAi(pendingAi.value.document, pendingAi.value.theme)
  pendingAi.value = undefined
}
function useMarketWork(work: string | ComponentInstance, sources: WorkSource[] = []) {
  pendingSources.value = cloneJson(sources)
  if (typeof work !== 'string' && workDependencies(work).length) {
    dependencyImport.value = work
    return
  }
  importMarketWork(work)
}
function importMarketWork(work: string | ComponentInstance) {
  const sources = cloneJson(pendingSources.value)
  dependencyImport.value = undefined
  replaceCreation(() => {
    const instance =
      typeof work === 'string'
        ? createInstance(examples.find((item) => item.id === work)!.create())
        : validateInstance(cloneJson(work))
    delete instance.templateId
    delete instance.templateVersion
    resetCreation('market')
    provenance.value = sources
    pendingSources.value = []
    active.value = instance
    dirty.value = true
  })
}
function prepareSubmission() {
  if (!active.value) return
  projectDraft.value = createSubmission(validateInstance(cloneJson(active.value)), provenance.value)
  draftSource.value = undefined
  tab.value = 'drafts'
}
function prepareProjectSubmission(project: TemplateRecord) {
  draftSource.value = undefined
  projectDraft.value = projectSubmission(project)
  tab.value = 'drafts'
}
function consumeSubmissionSource() {
  draftSource.value = undefined
  projectDraft.value = undefined
}
async function insert() {
  if (checkingArticle.value || !active.value) return
  try {
    const instance = validateInstance(active.value)
    if (articleSource.value) {
      if (!articleReviewed.value) throw new Error('请先核对原文依据、答案与补充推断')
      checkingArticle.value = true
      const fingerprint = JSON.stringify(instance)
      const report = await runInteractionCheck(instance, { maxCases: 80 })
      if (JSON.stringify(active.value) !== fingerprint)
        throw new Error('检查期间作品发生变化，请重新核对')
      if (report.cases.some((row) => row.status === 'failed'))
        throw new Error('交互检查未通过，请先修复后再插入文章')
    }
    emit('insert', instance, articleSource.value, cloneJson(provenance.value))
  } catch (cause) {
    error.value = errorMessage(cause)
  } finally {
    checkingArticle.value = false
  }
}
</script>
<template>
  <div :class="['lingui-studio', { 'lu-embedded': embedding }]">
    <DependencyMappingDialog
      v-if="dependencyImport"
      :instance="dependencyImport"
      :targets="active?.document.integrations ?? { apis: [], callbacks: [] }"
      @use="importMarketWork"
      @close="dependencyImport = undefined"
    />
    <div class="lu-app-layout">
      <StudioNavigation
        :section="tab"
        :mode="repository.mode"
        :embedding="embedding"
        :has-active="!!active"
        @navigate="tab = $event"
        @close="emit('close')"
      />
      <div class="lu-main-content">
        <p v-if="error" class="lu-global-error" role="alert">
          {{ error }} <button type="button" class="lu-text-button" @click="refresh">重试</button
          ><button type="button" class="lu-text-button" @click="error = ''">关闭提示</button>
        </p>
        <p v-if="history.error.value" class="lu-history-banner" role="alert">
          {{ history.error.value }}
          <button
            type="button"
            class="lu-text-button"
            :disabled="history.loading.value"
            @click="history.flush().catch(() => undefined)"
          >
            重试保存历史
          </button>
        </p>
        <p v-else-if="history.notice.value" class="lu-history-banner" role="status">
          {{ history.notice.value }}
        </p>
        <ArticleSourcePanel v-if="articleSource && tab === 'components'" :source="articleSource" />
        <SourceAttribution v-if="tab === 'components'" :sources="provenance" />
        <CreationWorkspace
          v-show="tab === 'components'"
          :key="session"
          :inert="history.loading.value || changingCreation"
          :aria-busy="history.loading.value || changingCreation"
          :instance="active"
          :dirty="dirty"
          :saved-version="activeTemplate ? active?.templateVersion : undefined"
          :themes="themes"
          :busy="aiBusy"
          :conflicted="!!pendingAi"
          :initial-candidates="candidates"
          @candidates="candidates = $event"
          :initial-recordings="recordings"
          @recordings="recordings = $event"
          :initial-editing="startEditing"
          :initial-conversation="conversation"
          :history-status="history.status.value"
          :revisions="revisions.history.value"
          :can-undo="revisions.canUndo.value"
          :can-redo="revisions.canRedo.value"
          :external-draft-count="canUseExternalDrafts() ? mcpInbox.pending.value : undefined"
          @external-drafts="mcpInbox.show"
          @undo="undo"
          @redo="redo"
          @restore-revision="restoreRevision"
          @conversation="conversation = $event"
          @editing="startEditing = $event"
          @history="openHistory"
          @update="update"
          @generated="generated"
          @busy="aiBusy = $event"
          @resolve="resolveAi"
          @save="openSaveDialog"
          @export="active && downloadJson(active.document.title, active.document)"
          @import="showImport = true"
          @projects="tab = 'projects'"
          @new="newConversation"
          @blank="createBlank"
          @submission="prepareSubmission"
          @catalog="tab = 'catalog'"
          @themes="tab = 'themes'"
          @fonts="tab = 'fonts'"
          @market="tab = 'market'"
        >
          <template v-if="embedding && active" #insert>
            <label v-if="articleSource" class="lu-article-reviewed"
              ><input v-model="articleReviewed" type="checkbox" />已核对原文与推断</label
            >
            <button
              type="button"
              class="lu-button primary"
              :disabled="
                aiBusy || !!pendingAi || checkingArticle || (!!articleSource && !articleReviewed)
              "
              @click="insert"
            >
              保存并插入文章
            </button>
          </template>
        </CreationWorkspace>
        <MarketplaceView
          :remote-enabled="repository.mode === 'halo'"
          v-if="tab === 'market'"
          @use="useMarketWork"
          @theme="useMarketTheme"
          @drafts="tab = 'drafts'"
        />
        <SubmissionWorkspace
          v-else-if="tab === 'drafts'"
          :source="draftSource"
          :source-draft="projectDraft"
          :recordings="recordings"
          :remote-enabled="repository.mode === 'halo'"
          @consumed="consumeSubmissionSource"
          @workspace="tab = 'components'"
          @themes="tab = 'themes'"
        />
        <McpManagementView
          v-else-if="tab === 'mcp'"
          :mode="repository.mode"
          @drafts="mcpInbox.show"
        />
        <template v-else-if="tab === 'catalog'"
          ><div class="lu-resource-back">
            <button type="button" class="lu-text-button" @click="tab = 'components'">
              ← 返回开发工作台
            </button>
          </div>
          <CatalogView /></template
        ><FontManagerView v-else-if="tab === 'fonts'" /><ThemeStudio
          v-else-if="tab === 'themes'"
          :themes="themes"
          :initial-theme="marketTheme"
          @save="saveTheme"
          @delete="deleteTheme"
          @submission="prepareThemeSubmission"
        /><ComponentLibrary
          v-else-if="tab === 'projects'"
          :templates="templates"
          :loading="loading"
          @open="openTemplate"
          @submission="prepareProjectSubmission"
          @market="tab = 'market'"
          @catalog="tab = 'catalog'"
          @themes="tab = 'themes'"
          @create="createBlank"
          @duplicate="duplicate"
          @delete="remove"
          @rename="rename"
          @export="downloadJson($event.name, $event.revisions.at(-1)!.document)"
          @ai="newConversation"
          @import="showImport = true"
        />
        <ImportDialog
          v-if="showImport"
          @close="showImport = false"
          @imported="imported"
        /><SaveTemplateDialog
          v-if="showSave && active"
          :name="active.document.title"
          :category="activeTemplate?.category"
          :categories="templates.map((template) => template.category)"
          :native-category-input="repository.mode === 'local'"
          :description="activeTemplate?.description"
          :updating="!!activeTemplate"
          :renaming="renaming"
          :busy="saving"
          :error="saveError"
          @close="showSave = false"
          @save="save"
        />
        <CreationHistoryDialog
          v-if="showHistory"
          :records="history.entries.value"
          :active-id="history.activeId.value"
          :loading="history.loading.value"
          :busy="aiBusy || saving || changingCreation"
          :error="history.error.value"
          @close="showHistory = false"
          @open="resumeHistory"
          @remove="removeHistory"
          @refresh="history.refresh"
          @new="newConversation"
        />
        <McpInboxDialog
          v-if="mcpInbox.open.value"
          :drafts="mcpInbox.drafts.value"
          :activities="mcpInbox.activities.value"
          :loading="mcpInbox.busy.value"
          :busy="loadingExternalDraft || aiBusy || saving || changingCreation || !!pendingAi"
          :applying="loadingExternalDraft"
          :blocked-reason="
            pendingAi
              ? '请先返回工作台处理 AI 修改冲突，再载入外部草稿。'
              : loadingExternalDraft
                ? '正在载入草稿，请稍候。'
                : '当前创作或保存正在进行，可浏览草稿，完成后再载入。'
          "
          :error="externalDraftError || mcpInbox.error.value"
          :client="mcpInbox.client"
          :load="reviewExternalDraft"
          @refresh="mcpInbox.refresh"
          @close="mcpInbox.open.value = false"
          @apply="applyExternalDraft"
          @selection="externalDraftError = ''"
        />
      </div>
    </div>
  </div>
</template>
