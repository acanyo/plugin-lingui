import { section, document } from './builders'
export function timelineExample() {
  return document('创作时间线', [
    section(
      'root',
      '从一个想法，到一篇好文章',
      '从捕捉灵感到分享迭代，让创作过程有迹可循。',
      ['timeline'],
      '创作时间线',
    ),
    { id: 'timeline', component: 'LingUI.Timeline', children: ['idea', 'write', 'publish'] },
    {
      id: 'idea',
      component: 'LingUI.TimelineItem',
      title: '捕捉灵感',
      description: '记下让你好奇的问题，给想法一点生长的空间。',
    },
    {
      id: 'write',
      component: 'LingUI.TimelineItem',
      title: '梳理与表达',
      description: '把知识组织成可交互的结构，让读者参与理解。',
    },
    {
      id: 'publish',
      component: 'LingUI.TimelineItem',
      title: '分享与迭代',
      description: '发布文章，收集反馈，让表达持续变好。',
    },
  ])
}
