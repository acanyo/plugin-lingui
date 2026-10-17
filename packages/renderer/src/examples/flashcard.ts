import { section, softCard, button, column, computed, document, text } from './builders'

export function flashcardExample() {
  return document(
    '知识闪卡',
    [
      section(
        'root',
        '先想一想，再看答案',
        '试着用自己的话解释，再对照答案。',
        ['content'],
        '概念复习',
      ),
      column('content', ['question-card', 'toggle', 'answer']),
      softCard('question-card', 'question'),
      text('question', 'HTTP 的“无状态”是什么意思？', 'h3'),
      button('toggle', 'toggleLabel', [{ type: 'toggleState', path: '/revealed' }], 'primary'),
      text(
        'toggleLabel',
        computed({ op: 'if', args: [{ path: '/revealed' }, '收起答案', '查看答案'] }),
      ),
      {
        id: 'answer',
        component: 'LingUI.Conditional',
        condition: { path: '/revealed' },
        child: 'answer-card',
      },
      softCard('answer-card', 'answerContent'),
      column('answerContent', ['answerTitle', 'explanation', 'example']),
      text('answerTitle', '每个请求都是独立的', 'h3'),
      text(
        'explanation',
        'HTTP 协议本身不会自动记住上一次请求。服务器需要通过 Cookie、会话或令牌等机制关联用户。',
      ),
      text('example', '就像每次去柜台，都需要再次出示你的会员卡。', 'caption'),
    ],
    { revealed: false },
  )
}
