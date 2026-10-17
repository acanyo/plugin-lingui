import { Node, VueNodeViewRenderer, type Editor, type Range } from '@halo-dev/richtext-editor'
import { markRaw, toRaw } from 'vue'
import LinguiBrandIcon from '../shared/LinguiBrandIcon.vue'
import LinguiNodeView from './LinguiNodeView.vue'
import LinguiToolboxItem from './LinguiToolboxItem.vue'
import { isComponentReference } from '@lingui/renderer'
import { nodeAttributes, type LinguiNodeAttributes } from './serialization'
import { openStudio } from './open-studio'
export const LinguiNode = Node.create({
  name: 'linguiComponent',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      componentId: {
        default: '',
        rendered: false,
        parseHTML: (element) => element.getAttribute('data-lingui') ?? '',
      },
    }
  },
  parseHTML() {
    return [
      {
        tag: 'lingui-component[data-lingui]',
        getAttrs: (element) =>
          isComponentReference(element.getAttribute('data-lingui') ?? '') ? null : false,
      },
    ]
  },
  renderHTML({ node }) {
    const attrs = node.attrs as LinguiNodeAttributes
    const element = document.createElement('lingui-component')
    if (!isComponentReference(attrs.componentId)) throw new Error('组件 ID 无效')
    element.setAttribute('data-lingui', attrs.componentId)
    return { dom: element }
  },
  addNodeView() {
    return VueNodeViewRenderer(LinguiNodeView)
  },
  addOptions() {
    return {
      ...this.parent?.(),
      getToolboxItems({ editor }: { editor: Editor }) {
        return [
          {
            priority: 80,
            component: markRaw(LinguiToolboxItem),
            props: { editor, mode: 'insert' },
          },
          {
            priority: 81,
            component: markRaw(LinguiToolboxItem),
            props: { editor, mode: 'transform' },
          },
        ]
      },
      getCommandMenuItems() {
        return {
          priority: 80,
          icon: markRaw(LinguiBrandIcon),
          title: '插入灵构 UI',
          keywords: ['lingui', '灵构', 'UI', '组件', '交互', 'AI'],
          command: ({ editor, range }: { editor: Editor; range: Range }) => {
            const rawEditor = toRaw(editor)
            openStudio(rawEditor, async (instance) => {
              const attrs = nodeAttributes(instance)
              if (
                !rawEditor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({ type: 'linguiComponent', attrs })
                  .run()
              )
                throw new Error('文章组件插入失败')
            })
          },
        }
      },
    }
  },
})
