import { resolveDocument } from '../protocol/validate'
import { serializeSource } from '../openui/source'
import { column, document, row, text, softCard } from './builders'
export function noticeExample() {
  const value = document(
    '重要提示',
    [
      { id: 'root', component: 'LingUI.Callout', child: 'content', tone: { path: '/tone' } },
      column('content', ['heading', 'summary', 'details', 'read', 'settings']),
      softCard('settings', 'types'),
      { ...row('heading', ['icon', 'title']), align: 'start' },
      { id: 'icon', component: 'Icon', name: 'warning' },
      text('title', { path: '/title' }, 'h2'),
      text('summary', { path: '/message' }),
      {
        id: 'details',
        component: 'LingUI.Collapse',
        title: '查看详细说明',
        child: 'detailText',
        expanded: { path: '/expanded' },
      },
      text(
        'detailText',
        '组件保存的是完整结构化数据。模板更新不会自动替换文章中的实例，你可以随时重新打开并编辑。',
      ),
      {
        id: 'read',
        component: 'CheckBox',
        label: '我已阅读并了解这条提示',
        value: { path: '/read' },
      },
      {
        id: 'types',
        component: 'ChoicePicker',
        label: '提示类型',
        value: { path: '/type' },
        options: [
          { label: '提醒', value: 'warning' },
          { label: '信息', value: 'info' },
          { label: '成功', value: 'success' },
        ],
      },
    ],
    {
      title: '编辑前请保存草稿',
      message: '保存当前文章后再修改组件，避免未保存的内容丢失。',
      expanded: false,
      read: false,
      tone: 'warning',
      type: ['warning'],
    },
  )
  // The callout derives its tone from the same selection state used by ChoicePicker.
  const nodes = Object.values(resolveDocument(value).nodes)
  nodes[0]!.tone = {
    call: 'lingui.evaluate',
    args: {
      expression: {
        op: 'if',
        args: [
          { op: 'includes', args: [{ path: '/type' }, 'success'] },
          'success',
          {
            op: 'if',
            args: [{ op: 'includes', args: [{ path: '/type' }, 'info'] }, 'info', 'warning'],
          },
        ],
      },
    },
  }
  value.source = serializeSource(nodes)
  value.parameters = [
    { key: 'title', label: '标题', path: '/title', type: 'string', default: '编辑前请保存草稿' },
    {
      key: 'message',
      label: '提示内容',
      path: '/message',
      type: 'string',
      default: '保存当前文章后再修改组件，避免未保存的内容丢失。',
    },
  ]
  return value
}
