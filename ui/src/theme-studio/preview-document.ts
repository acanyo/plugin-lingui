import { serializeSource, type ComponentNode, type LinguiDocument } from '@lingui/renderer'

/** A transient specimen, never persisted as a project or market work. */
export function themeControlsDocument(): LinguiDocument {
  const nodes: ComponentNode[] = [
    { id: 'root', component: 'Column', children: ['intro', 'formCard', 'feedbackCard'] },
    { id: 'intro', component: 'Column', children: ['eyebrow', 'title', 'description'] },
    {
      id: 'eyebrow',
      component: 'LingUI.Badge',
      text: '主题预览',
      tone: 'info',
      variant: 'outline',
    },
    { id: 'title', component: 'Text', text: '每个细节，都属于你的风格。', variant: 'h2' },
    {
      id: 'description',
      component: 'Text',
      text: '试用下方控件，查看输入、选择和反馈的真实效果。',
      variant: 'caption',
    },
    { id: 'formCard', component: 'Card', child: 'form' },
    { id: 'form', component: 'Column', children: ['formTitle', 'fields', 'switch', 'actions'] },
    { id: 'formTitle', component: 'Text', text: '创作偏好', variant: 'h3' },
    { id: 'fields', component: 'LingUI.Grid', maxColumns: 2, children: ['name', 'category'] },
    {
      id: 'name',
      component: 'TextField',
      label: '作品名称',
      value: { path: '/name' },
      placeholder: '给作品起一个名字',
      clearable: true,
      hint: '输入时留意边框和焦点光圈。',
    },
    {
      id: 'category',
      component: 'LingUI.Select',
      label: '作品分类',
      value: { path: '/category' },
      options: [
        { value: 'interactive', label: '交互组件', description: '可以参与、可以探索' },
        { value: 'content', label: '内容表达', description: '让信息更清晰' },
        { value: 'visual', label: '数据可视化', description: '从数据中发现规律' },
      ],
      hint: '展开菜单，查看选中与悬停效果。',
    },
    {
      id: 'switch',
      component: 'LingUI.Switch',
      label: '接收作品动态',
      description: '有新版本时通知我',
      value: { path: '/notifications' },
    },
    { id: 'actions', component: 'Row', children: ['submit', 'secondary', 'disabled'] },
    {
      id: 'submit',
      component: 'Button',
      child: 'submitText',
      variant: 'primary',
      action: {
        functionCall: {
          call: 'lingui.dispatch',
          args: {
            actions: [
              { type: 'setState', path: '/message', value: '偏好已更新，继续试试其他主题。' },
            ],
          },
        },
      },
    },
    { id: 'submitText', component: 'Text', text: '保存偏好' },
    {
      id: 'secondary',
      component: 'LingUI.Dropdown',
      label: '更多操作',
      menuItems: [
        {
          id: 'edit',
          label: '编辑作品',
          group: '作品',
          action: {
            functionCall: {
              call: 'lingui.dispatch',
              args: {
                actions: [{ type: 'setState', path: '/message', value: '已选择编辑作品。' }],
              },
            },
          },
        },
        {
          id: 'copy',
          label: '创建副本',
          group: '作品',
          action: {
            functionCall: {
              call: 'lingui.dispatch',
              args: {
                actions: [{ type: 'setState', path: '/message', value: '已选择创建副本。' }],
              },
            },
          },
        },
      ],
    },
    {
      id: 'disabled',
      component: 'Button',
      child: 'disabledText',
      disabled: true,
      action: { functionCall: { call: 'lingui.dispatch', args: { actions: [{ type: 'reset' }] } } },
    },
    { id: 'disabledText', component: 'Text', text: '暂不可用' },
    { id: 'feedbackCard', component: 'Card', variant: 'soft', child: 'feedback' },
    {
      id: 'feedback',
      component: 'Column',
      children: ['feedbackTitle', 'badges', 'message', 'error'],
    },
    { id: 'feedbackTitle', component: 'Text', text: '状态与反馈', variant: 'h3' },
    {
      id: 'badges',
      component: 'Row',
      children: ['badgeSuccess', 'badgeInfo', 'badgeWarning', 'badgeDanger'],
    },
    { id: 'badgeSuccess', component: 'LingUI.Badge', text: '已完成', tone: 'success' },
    { id: 'badgeInfo', component: 'LingUI.Badge', text: '进行中', tone: 'info' },
    { id: 'badgeWarning', component: 'LingUI.Badge', text: '待确认', tone: 'warning' },
    { id: 'badgeDanger', component: 'LingUI.Badge', text: '需修改', tone: 'danger' },
    { id: 'message', component: 'Text', text: { path: '/message' }, variant: 'caption' },
    {
      id: 'error',
      component: 'TextField',
      label: '错误状态示例',
      value: { path: '/invalid' },
      status: 'error',
      hint: '请填写完整的作品链接。',
    },
  ]
  return {
    schemaVersion: 'lingui.document/2',
    title: '基础控件主题预览',
    parameters: [],
    source: serializeSource(nodes),
    state: {
      name: '我的交互作品',
      category: 'interactive',
      notifications: true,
      message: '按钮、标签和反馈颜色跟随当前主题。',
      invalid: 'https://',
    },
  }
}
