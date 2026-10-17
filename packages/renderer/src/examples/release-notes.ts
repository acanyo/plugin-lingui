import { section, document, text } from './builders'

export function releaseNotesExample() {
  return document(
    '更新日志',
    [
      section(
        'root',
        '让每次改进都有迹可循',
        '记录新增、改进与修复，方便读者快速了解变化。',
        ['timeline'],
        '更新日志',
      ),
      { id: 'timeline', component: 'LingUI.Timeline', children: ['v3', 'v2', 'v1'] },
      {
        id: 'v3',
        component: 'LingUI.TimelineItem',
        title: 'v1.2 · 更完整的内容表达',
        description: '新增方案对比、数字指标和引用；文章中的信息更容易阅读。',
        child: 'details',
      },
      {
        id: 'details',
        component: 'LingUI.Collapse',
        title: '查看更新说明',
        expanded: { path: '/details' },
        child: 'detailText',
      },
      text('detailText', '文章和主题统一通过项目 ID 引用组件。保存项目后，刷新页面即可展示最新版本。'),
      {
        id: 'v2',
        component: 'LingUI.TimelineItem',
        title: 'v1.1 · 更顺手的编辑',
        description: '完善手机预览、主题切换和组件复用。',
      },
      {
        id: 'v1',
        component: 'LingUI.TimelineItem',
        title: 'v1.0 · 从第一篇开始',
        description: '支持可编辑的提示、问答与基础互动组件。',
      },
    ],
    { details: false },
  )
}
