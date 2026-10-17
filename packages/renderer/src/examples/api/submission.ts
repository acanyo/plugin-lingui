import { column, text } from '../builders'
import { apiDocument, apiEvent, apiExamplePrefix } from './builders'

export function apiSubmissionExample() {
  return apiDocument(
    '表单提交与回执',
    '填写姓名和建议，先校验再提交。模拟接口只返回回执，不会发送或保存你的输入。',
    ['form', 'receipt', 'error-text'],
    [
      {
        id: 'form',
        component: 'LingUI.FormGroup',
        label: '提交一条建议',
        child: 'fields',
        disabled: { path: '/loading' },
        events: {
          submit: {
            ...apiEvent(
              'submitFeedback',
              { name: { $state: '/name' }, message: { $state: '/message' } },
              '/receipt',
            ),
            actions: [
              {
                type: 'local',
                actions: [{ type: 'setState', path: '/receipt', value: { message: '' } }],
              },
              {
                type: 'api',
                name: 'submitFeedback',
                args: { name: { $state: '/name' }, message: { $state: '/message' } },
              },
            ],
          },
        },
      },
      column('fields', ['name', 'message', 'submit']),
      {
        id: 'name',
        component: 'TextField',
        label: '你的称呼',
        placeholder: '如何称呼你',
        value: { path: '/name' },
        required: true,
        minLength: 2,
        maxLength: 40,
      },
      {
        id: 'message',
        component: 'TextField',
        label: '建议内容',
        placeholder: '至少输入 5 个字',
        variant: 'longText',
        value: { path: '/message' },
        required: true,
        minLength: 5,
        maxLength: 500,
        showCount: true,
      },
      {
        id: 'submit',
        component: 'Button',
        child: 'submit-label',
        buttonType: 'submit',
        variant: 'primary',
        loading: { path: '/loading' },
      },
      text('submit-label', '提交建议'),
      text('receipt', { path: '/receipt/message' }),
      text('error-text', { path: '/error' }, 'caption'),
    ],
    [
      {
        name: 'submitFeedback',
        label: '提交建议',
        method: 'POST',
        url: `${apiExamplePrefix}feedback`,
        description: '将表单字段以 JSON 提交，返回 accepted 和 message；模拟环境不会写入任何数据。',
        inputExample: { name: '小林', message: '希望增加更多接口案例。' },
        responseExample: { accepted: true, message: '已收到你的建议（模拟回执，未实际保存）。' },
      },
    ],
    { name: '', message: '', receipt: { message: '提交后在这里查看回执。' } },
  )
}
