import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { utils } from '@halo-dev/ui-shared'
import { examples } from '@lingui/renderer'
import ComponentLibrary from '../component-library/ComponentLibrary.vue'
import { createHaloRepository } from '../services/halo-repository'
import { repositoryKey } from '../services/repository'

let wrapper: VueWrapper | undefined
const previous = utils.permission.getUserPermissions()
afterEach(() => {
  wrapper?.unmount()
  utils.permission.setUserPermissions(previous ?? [])
})

describe('Halo author access', () => {
  it.each([
    { permissions: ['plugin:plugin-lingui:library:view'], canManage: false },
    { permissions: ['plugin:plugin-lingui:components:manage'], canManage: true },
    { permissions: ['*'], canManage: true },
  ])(
    'retains author composition while controlling shared template mutation: $canManage',
    ({ permissions, canManage }) => {
      utils.permission.setUserPermissions(permissions)
      wrapper = mount(ComponentLibrary, {
        global: { provide: { [repositoryKey as symbol]: createHaloRepository() } },
        props: {
          loading: false,
          templates: [
            {
              id: 'shared-component',
              name: '共享提示',
              category: '提示',
              description: '',
              revisions: [
                { version: 1, createdAt: '2026-10-11T00:00:00Z', document: examples[0]!.create() },
              ],
            },
          ],
        },
      })
      const labels = wrapper.findAll('button').map((button) => button.text())
      expect(labels).toContain('新建空白组件')
      expect(labels).toContain('编辑')
      expect(labels).toContain('导出当前版本')
      expect(labels.includes('删除')).toBe(canManage)
      expect(labels.includes('创建副本')).toBe(canManage)
      expect(labels.includes('重命名与分类')).toBe(canManage)
    },
  )
})
