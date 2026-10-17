import { softCard, column, document, text } from './builders'

export function quoteExample() {
  return document('观点引用', [
    column('root', ['quote', 'context-card']),
    softCard('context-card', 'context'),
    {
      id: 'quote',
      component: 'LingUI.Quote',
      text: '好的交互，应该让内容更容易理解。',
      label: '编辑手记',
      description: '关于文章中的互动设计',
    },
    text(
      'context',
      '在文章里，交互的价值来自它帮助读者完成的那一步：理解、比较、计算，或做出选择。',
      'caption',
    ),
  ])
}
