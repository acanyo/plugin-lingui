import { section, column, document, text } from './builders'

export function comparisonExample() {
  return document('方案对比', [
    section(
      'root',
      '选适合你的内容管理方式',
      '从写作习惯和维护成本出发，比单纯比较功能更有用。',
      ['content'],
      '方案对比',
    ),
    column('content', ['table', 'note']),
    {
      id: 'table',
      component: 'LingUI.Table',
      label: '静态站点与 Halo 对比',
      columns: ['对比维度', '静态站点', 'Halo'],
      rows: [
        { label: '写作方式', cells: ['Markdown 文件', '在线可视化编辑'] },
        { label: '内容更新', cells: ['构建后发布', '保存后发布'] },
        { label: '扩展方式', cells: ['代码与构建插件', '主题与插件'] },
        { label: '适合谁', cells: ['熟悉开发流程的作者', '希望专注内容的作者'] },
      ],
    },
    text('note', '两种方式都能做好博客，按自己的工作习惯选择即可。', 'caption'),
  ])
}
