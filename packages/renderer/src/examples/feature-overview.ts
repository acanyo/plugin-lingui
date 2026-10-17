import { column, document, grid, section, softCard, text } from './builders'
export function featureOverviewExample() {
  const features = [
    ['对话创作', '先描述你想讲清楚的问题，再通过对话逐步调整内容与交互。'],
    ['实时试用', '在旁边直接操作生成的作品，切换手机尺寸，或全屏查看细节。'],
    ['自由调整', '修改标题、代码和图表数据，调整会保留在下一次 AI 对话中。'],
    ['分享作品', '主动保存为项目，准备投稿草稿，把自己的作品带到社区。'],
  ]
  return document('创作工作流', [
    column('root', ['intro', 'closing']),
    section(
      'intro',
      '从一个想法，到一件可用的作品',
      '把讲解、工具和互动放进同一个创作流程。你决定内容，组件负责清晰地呈现。',
      ['features'],
      '灵构 UI · 创作工作流',
    ),
    grid(
      'features',
      features.map((_, i) => `card-${i}`),
    ),
    ...features.flatMap(([title, body], i) => [
      softCard(`card-${i}`, `content-${i}`),
      column(`content-${i}`, [`icon-${i}`, `title-${i}`, `body-${i}`]),
      { id: `icon-${i}`, component: 'Icon' as const, name: ['sparkles', 'layers', 'code', 'arrow'][i]! },
      text(`title-${i}`, title!, 'h3'),
      text(`body-${i}`, body!),
    ]),
    text('closing', '从一个具体的问题开始，会更容易获得清晰、有用的结果。', 'caption'),
  ])
}
