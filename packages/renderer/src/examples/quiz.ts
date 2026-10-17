import { section, button, column, computed, document, row, text } from './builders'
export function quizExample() {
  const answered = {
    op: 'or',
    args: ['counter', 'heap', 'stack', 'native'].map((value) => ({
      op: 'includes',
      args: [{ path: '/answer' }, value],
    })),
  }
  const unanswered = { op: 'not', args: [answered] }
  return document(
    '知识测验',
    [
      section(
        'root',
        '下面哪一个区域主要存储对象实例？',
        '选择一个答案，再查看解释，帮助你理解 JVM 运行时数据区。',
        ['content'],
        'JVM · 知识测验',
      ),
      column('content', ['choices', 'answerHint', 'actions', 'feedback']),
      row('actions', ['submit', 'retry']),
      {
        id: 'choices',
        component: 'ChoicePicker',
        label: '选择你的答案',
        value: { path: '/answer' },
        variant: 'mutuallyExclusive',
        options: [
          { label: '程序计数器', value: 'counter' },
          { label: '堆内存', value: 'heap' },
          { label: '虚拟机栈', value: 'stack' },
          { label: '本地方法栈', value: 'native' },
        ],
      },
      {
        ...button(
          'submit',
          'submitLabel',
          [{ type: 'setState', path: '/submitted', value: answered }],
          'primary',
        ),
        disabled: computed(unanswered),
      },
      {
        id: 'answerHint',
        component: 'LingUI.Conditional',
        condition: unanswered,
        child: 'answerHintText',
      },
      text('answerHintText', '请先选择一个答案，再提交查看解析。', 'caption'),
      text('submitLabel', '提交答案'),
      {
        id: 'retry',
        component: 'LingUI.Conditional',
        condition: { path: '/submitted' },
        child: 'reset',
      },
      button('reset', 'resetLabel', [{ type: 'reset' }], 'text'),
      text('resetLabel', '重新作答'),
      {
        id: 'feedback',
        component: 'LingUI.Conditional',
        condition: { path: '/submitted' },
        child: 'result',
      },
      {
        id: 'result',
        component: 'LingUI.Callout',
        tone: {
          call: 'lingui.evaluate',
          args: {
            expression: {
              op: 'if',
              args: [{ op: 'includes', args: [{ path: '/answer' }, 'heap'] }, 'success', 'warning'],
            },
          },
        },
        child: 'resultContent',
      },
      column('resultContent', ['resultTitle', 'explanation']),
      text(
        'resultTitle',
        {
          call: 'lingui.evaluate',
          args: {
            expression: {
              op: 'if',
              args: [
                { op: 'includes', args: [{ path: '/answer' }, 'heap'] },
                '回答正确',
                '再想一想，正确答案是堆内存',
              ],
            },
          },
        },
        'h3',
      ),
      text(
        'explanation',
        '堆是 JVM 中存储对象实例的主要区域，由所有线程共享，通常也是垃圾收集器管理的核心区域。',
      ),
    ],
    { answer: [], submitted: false },
  )
}
