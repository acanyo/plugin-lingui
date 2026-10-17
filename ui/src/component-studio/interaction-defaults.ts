import { writePath, type Action, type ComponentNode, type State } from '@lingui/renderer'

/** Small, interactive examples that are created only when a user adds or previews a primitive. */
export function initializeInteractionNode(node: ComponentNode, state: State) {
  const path = `/fields/${node.id}`
  const action = (value: string): Action => ({
    functionCall: {
      call: 'lingui.dispatch',
      args: { actions: [{ type: 'setState', path, value }] },
    },
  })
  switch (node.component) {
    case 'LingUI.Dropdown':
      node.label = { path }
      writePath(state, path, '更多操作')
      node.menuItems = [
        { id: 'copy', label: '复制内容', group: '常用操作', action: action('已选择复制') },
        { id: 'edit', label: '编辑内容', group: '常用操作', action: action('已选择编辑') },
        { id: 'archive', label: '归档', group: '其他操作', action: action('已选择归档') },
      ]
      break
    case 'LingUI.Popconfirm':
      node.label = { path }
      writePath(state, path, '确认操作')
      node.text = '确定执行这个操作吗？'
      node.confirmText = '确认'
      node.cancelText = '取消'
      node.tone = 'warning'
      node.action = action('操作已确认')
      break
    case 'LingUI.Cascader':
    case 'LingUI.TreeSelect':
      node.label = node.component === 'LingUI.Cascader' ? '选择分类' : '选择节点'
      node.value = { path }
      writePath(state, path, '')
      node.clearable = true
      node.treeItems = [
        { id: 'design', label: '设计' },
        { id: 'layout', label: '布局', parent: 'design' },
        { id: 'grid', label: '网格', parent: 'layout' },
        { id: 'flex', label: '弹性布局', parent: 'layout' },
        { id: 'color', label: '颜色', parent: 'design' },
        { id: 'development', label: '开发' },
        { id: 'frontend', label: '前端', parent: 'development' },
        { id: 'backend', label: '后端', parent: 'development' },
      ]
      break
    case 'LingUI.DynamicInput':
      node.label = '动态输入'
      node.value = { path }
      node.maxRows = 6
      node.minRows = 0
      node.addText = '添加条目'
      node.fields = [
        { key: 'name', label: '名称', placeholder: '填写名称' },
        { key: 'value', label: '内容', placeholder: '填写内容' },
      ]
      writePath(state, path, [{ name: '第一项', value: '可继续添加或调整顺序' }])
      break
  }
}
