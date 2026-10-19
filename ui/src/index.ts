import { definePlugin } from '@halo-dev/ui-shared'
import LinguiBrandIcon from './shared/LinguiBrandIcon.vue'
import { markRaw } from 'vue'
import { LinguiNode } from './editor-extension/LinguiNode'
export default definePlugin({
  routes: [
    {
      parentName: 'Root',
      route: {
        path: '/lingui',
        name: 'LinguiStudio',
        component: () => import('./views/HomeView.vue'),
        props: (route) => ({
          projectId: typeof route.query.project === 'string' ? route.query.project : undefined,
        }),
        meta: {
          title: '灵构 UI',
          hideFooter: true,
          searchable: true,
          permissions: ['plugin:plugin-lingui:library:view'],
          menu: { name: '灵构 UI', group: 'content', icon: markRaw(LinguiBrandIcon), priority: 4 },
        },
      },
    },
  ],
  extensionPoints: { 'default:editor:extension:create': () => [LinguiNode] },
})
