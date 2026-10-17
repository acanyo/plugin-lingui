import { section, column, document, text } from './builders'
export function faqExample() {
  const value = document(
    '常见问题',
    [
      section(
        'root',
        '常见问题',
        '关于文章展示、项目引用与组件导入，找到你关心的答案。',
        ['content'],
        '使用指南',
      ),
      column('content', ['mode', 'questions']),
      column('questions', ['one', 'two', 'three']),
      {
        id: 'mode',
        component: 'LingUI.Switch',
        label: '允许同时展开多个问题',
        value: { path: '/multiple' },
      },
      ...[
        [
          'one',
          '发布后还需要调用 AI 吗？',
          '不需要。所有内容和初始状态都保存在文章中，读者可以直接查看和交互。',
        ],
        [
          'two',
          '更新模板会影响旧文章吗？',
          '文章通过项目 ID 展示组件。保存项目新版本后，刷新文章即可看到更新。',
        ],
        [
          'three',
          '可以使用其他 AI 生成的 JSON 吗？',
          '可以。包含 OpenUI 源码与初始状态的作品 JSON 会经过结构、引用和安全校验后导入。',
        ],
      ].flatMap(([id, question, answer]) => [
        {
          id: id!,
          component: 'LingUI.Collapse' as const,
          title: question!,
          child: `${id}-answer`,
          expanded: { path: `/open/${id}` },
          exclusiveGroup: 'faq',
          multiple: { path: '/multiple' },
        },
        text(`${id}-answer`, answer!),
      ]),
    ],
    { multiple: false, open: { one: true, two: false, three: false } },
  )
  return value
}
