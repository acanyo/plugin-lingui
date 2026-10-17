import { section, softCard, badge, button, column, computed, document, text } from './builders'
import type { Expression } from '../protocol/types'

export function checklistExample() {
  const items = ['核对标题与摘要', '检查配图和替代文本', '预览手机端排版', '检查引用与链接']
  const completed: Expression = {
    op: 'add',
    args: items.map((_, index) => ({ op: 'if', args: [{ path: `/done${index}` }, 1, 0] })),
  }
  return document(
    '发布检查清单',
    [
      section(
        'root',
        '让好内容，准备就绪',
        '发布前花一分钟，检查容易忽略的细节。',
        ['content'],
        '发布检查',
      ),
      column('content', ['progress', 'check-card', 'complete', 'reset']),
      softCard('check-card', 'checks'),
      {
        id: 'progress',
        component: 'LingUI.Progress',
        label: '检查进度',
        value: computed(completed),
        max: 4,
      },
      column(
        'checks',
        items.map((_, index) => `check${index}`),
      ),
      ...items.map((label, index) => ({
        id: `check${index}`,
        component: 'CheckBox' as const,
        label,
        value: { path: `/done${index}` },
      })),
      {
        id: 'complete',
        component: 'LingUI.Conditional',
        condition: { op: 'eq', args: [completed, 4] },
        child: 'success',
      },
      badge('success', '全部检查完成，可以发布了', 'success'),
      button('reset', 'resetLabel', [{ type: 'reset' }], 'text'),
      text('resetLabel', '重新检查'),
    ],
    { done0: false, done1: false, done2: false, done3: false },
  )
}
