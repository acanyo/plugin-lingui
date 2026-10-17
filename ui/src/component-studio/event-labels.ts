import type { ComponentEventName, EventAction } from '@lingui/renderer'
export const eventLabels: Record<ComponentEventName, string> = {
  mount: '打开时自动执行',
  retry: '重试加载',
  click: '点击',
  input: '输入',
  change: '值变化',
  focus: '获得焦点',
  blur: '失去焦点',
  enter: '按下回车',
  search: '执行搜索',
  clear: '清空',
  select: '选择条目',
  open: '打开',
  close: '关闭',
  confirm: '确认',
  cancel: '取消',
  add: '添加条目',
  remove: '删除条目',
  reorder: '调整顺序',
  move: '移动任务',
  submit: '提交表单',
  invalid: '校验失败',
  load: '加载完成',
  error: '加载失败',
  play: '开始播放',
  pause: '暂停播放',
  ended: '播放结束',
  timeUpdate: '播放进度变化',
}
export const eventActionLabels: Record<EventAction['type'], string> = {
  api: '调用已配置接口',
  local: '修改本地状态',
  request: '调用 API 接口',
  callback: '调用 JS 回调',
  delay: '等待',
  emit: '发送自定义事件',
}
export function newEventAction(type: EventAction['type']): EventAction {
  switch (type) {
    case 'api':
      return { type, name: 'search', args: {} }
    case 'local':
      return { type, actions: [{ type: 'setState', path: '/message', value: '完成' }] }
    case 'request':
      return { type, method: 'GET', url: '/api/example', response: 'json', timeoutMs: 15000 }
    case 'callback':
      return { type, name: 'onSave', args: { $state: '/' }, timeoutMs: 15000 }
    case 'delay':
      return { type, ms: 300 }
    case 'emit':
      return { type, name: 'work.saved', detail: { $event: '/' } }
  }
}
