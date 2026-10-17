import { checklistExample } from './checklist'
import { flashcardExample } from './flashcard'
import { stepsExample } from './steps'
import { comparisonExample } from './comparison'
import { summaryExample } from './summary'
import { glossaryExample } from './glossary'
import { budgetExample } from './budget'
import { converterExample } from './converter'
import { decisionExample } from './decision'
import { releaseNotesExample } from './release-notes'
import { quoteExample } from './quote'
import { statisticsExample } from './statistics'
import { noticeExample } from './notice'
import { faqExample } from './faq'
import { quizExample } from './quiz'
import { calculatorExample } from './calculator'
import { architectureExample } from './architecture'
import { timelineExample } from './timeline'
import { springFluxExample } from './spring-flux'
import { codeGuideExample } from './code-guide'
import { benchmarkExample } from './benchmark'
import { featureOverviewExample } from './feature-overview'
import { lessonPlannerExample } from './lesson-planner'
import { mediaNotebookExample } from './media-notebook'
import { apiExamples } from './api'
export { apiExamples, apiExamplePrefix, createDemoRequests, isDemoApi } from './api'
export const examples = [
  {
    id: 'notice',
    title: '重要提示',
    category: '内容表达',
    description: '让重要信息被看见，支持展开与确认。',
    icon: 'warning',
    create: noticeExample,
  },
  {
    id: 'faq',
    title: '常见问题',
    category: '内容表达',
    description: '把读者关心的问题，一一解释清楚。',
    icon: 'help',
    create: faqExample,
  },
  {
    id: 'quiz',
    title: '知识测验',
    category: '互动学习',
    description: '让读者参与思考，获得即时反馈。',
    icon: 'book',
    create: quizExample,
  },
  {
    id: 'calculator',
    title: '参数计算器',
    category: '实用工具',
    description: '调整数字和滑块，直观看到计算结果。',
    icon: 'code',
    create: calculatorExample,
  },
  {
    id: 'architecture',
    title: '交互式架构图',
    category: '技术图解',
    description: '探索多级节点，让复杂知识更清晰。',
    icon: 'layers',
    create: architectureExample,
  },
  {
    id: 'timeline',
    title: '时间线',
    category: '内容表达',
    description: '用清晰的时间顺序，讲述一段过程。',
    icon: 'clock',
    create: timelineExample,
  },
  {
    id: 'checklist',
    title: '发布检查清单',
    category: '实用工具',
    description: '逐项检查，实时显示完成进度。',
    icon: 'check',
    create: checklistExample,
  },
  {
    id: 'flashcard',
    title: '知识闪卡',
    category: '互动学习',
    description: '先思考，再展开答案与解释。',
    icon: 'book',
    create: flashcardExample,
  },
  {
    id: 'steps',
    title: '分步教程',
    category: '互动学习',
    description: '把长教程拆成可以跟随的步骤。',
    icon: 'list',
    create: stepsExample,
  },
  {
    id: 'comparison',
    title: '方案对比',
    category: '内容表达',
    description: '按维度比较，让选择更清楚。',
    icon: 'columns',
    create: comparisonExample,
  },
  {
    id: 'summary',
    title: '文章摘要',
    category: '内容表达',
    description: '用三个要点，交代文章的核心内容。',
    icon: 'list',
    create: summaryExample,
  },
  {
    id: 'glossary',
    title: '术语解释',
    category: '互动学习',
    description: '切换概念，用日常例子理解术语。',
    icon: 'help',
    create: glossaryExample,
  },
  {
    id: 'budget',
    title: '出行预算',
    category: '实用工具',
    description: '调整天数与开销，即时估算总花费。',
    icon: 'calculator',
    create: budgetExample,
  },
  {
    id: 'converter',
    title: '温度换算',
    category: '实用工具',
    description: '输入或拖动温度，查看换算结果。',
    icon: 'arrow',
    create: converterExample,
  },
  {
    id: 'decision',
    title: '阅读路线选择',
    category: '互动学习',
    description: '根据读者的选择，给出不同阅读建议。',
    icon: 'signpost',
    create: decisionExample,
  },
  {
    id: 'release-notes',
    title: '更新日志',
    category: '内容表达',
    description: '按版本记录变化，展开查看细节。',
    icon: 'clock',
    create: releaseNotesExample,
  },
  {
    id: 'quote',
    title: '观点引用',
    category: '内容表达',
    description: '用清晰的引文与署名，突出值得记住的话。',
    icon: 'quote',
    create: quoteExample,
  },
  {
    id: 'statistics',
    title: '数据概览',
    category: '内容表达',
    description: '让关键数字、单位与说明一目了然。',
    icon: 'chart',
    create: statisticsExample,
  },
  {
    id: 'spring-flux',
    title: 'Spring WebFlux 原理图解',
    category: '技术图解',
    description: '用数据流、概念卡片和真实代码解释响应式编程。',
    icon: 'layers',
    create: springFluxExample,
  },
  {
    id: 'code-guide',
    title: 'Fetch 请求速查',
    category: '技术图解',
    description: '可复制的代码示例，配上逐项解释。',
    icon: 'code',
    create: codeGuideExample,
  },
  {
    id: 'benchmark',
    title: '性能实验记录',
    category: '实用工具',
    description: '用指标、条形图和实验条件记录优化结果。',
    icon: 'chart',
    create: benchmarkExample,
  },
  {
    id: 'feature-overview',
    title: '创作工作流',
    category: '内容表达',
    description: '用舒展的网格和清楚的层级呈现产品能力。',
    icon: 'grid',
    create: featureOverviewExample,
  },
  {
    id: 'lesson-planner',
    title: '阅读计划',
    category: '互动学习',
    description: '切换阅读路线与计划，选择日期、时间并记录目标。',
    icon: 'book',
    create: lessonPlannerExample,
  },
  {
    id: 'media-notebook',
    title: '多媒体笔记',
    category: '内容表达',
    description: '把自己的图片、视频和音频放进可复用的文章作品。',
    icon: 'layers',
    create: mediaNotebookExample,
  },
  ...apiExamples,
]
