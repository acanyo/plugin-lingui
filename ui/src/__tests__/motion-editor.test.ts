import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { ComponentNode } from '@lingui/renderer'
import MotionProperties from '../component-studio/MotionProperties.vue'

describe('motion property editor', () => {
  it('configures presets and timing while preserving existing node behavior and unrelated effects', async () => {
    const node: ComponentNode = {
      id: 'button',
      component: 'Button',
      child: 'label',
      motion: { hover: { preset: 'lift' } },
      events: { click: { actions: [{ type: 'emit', name: 'save' }] } },
    }
    const wrapper = mount(MotionProperties, { props: { node } })
    await wrapper.get('select[aria-label="入场动画"]').setValue('fade-up')
    const saved = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
    expect(saved.motion).toEqual({ hover: { preset: 'lift' }, enter: { preset: 'fade-up' } })
    expect(saved.events).toEqual(node.events)
    await wrapper.setProps({ node: saved })
    await wrapper.get('input[aria-label="入场时长"]').setValue(350)
    const timed = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
    expect(timed.motion?.enter?.duration).toBe(350)
    await wrapper.setProps({ node: timed })
    await wrapper.get('select[aria-label="入场动画"]').setValue('')
    expect((wrapper.emitted('update')!.at(-1)![0] as ComponentNode).motion).toEqual({
      hover: { preset: 'lift' },
    })
    wrapper.unmount()
  })
  it('offers state transitions on supported components and removes an empty motion object', async () => {
    const wrapper = mount(MotionProperties, {
      props: {
        node: {
          id: 'collapse',
          component: 'LingUI.Collapse',
          title: '展开',
          child: 'content',
          expanded: { path: '/expanded' },
        } as ComponentNode,
      },
    })
    await wrapper.get('input[type="checkbox"]').setValue(true)
    const node = wrapper.emitted('update')!.at(-1)![0] as ComponentNode
    expect(node.motion?.transition?.duration).toBe(240)
    await wrapper.setProps({ node })
    await wrapper.get('input[type="checkbox"]').setValue(false)
    expect((wrapper.emitted('update')!.at(-1)![0] as ComponentNode).motion).toBeUndefined()
    wrapper.unmount()
  })
})
