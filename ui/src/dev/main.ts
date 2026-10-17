import { createApp } from 'vue'
import { plugin as formkit, defaultConfig } from '@formkit/vue'
import '@halo-dev/components/dist/style.css'
import DevApp from './DevApp.vue'
createApp(DevApp).use(formkit, defaultConfig()).mount('#app')
