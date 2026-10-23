import { rsbuildConfig } from '@halo-dev/ui-plugin-bundler-kit/rsbuild'
import { pluginSass } from '@rsbuild/plugin-sass'
import Icons from 'unplugin-icons/rspack'
import type { RsbuildConfig } from '@rsbuild/core'
export default rsbuildConfig({
  rsbuild: {
    resolve: { alias: { '@': './src' } },
    plugins: [pluginSass()],
    tools: {
      rspack: {
        plugins: [Icons({ compiler: 'vue3' })],
        // The prebundled Svelte renderer must retain its own module scope. Re-concatenating it
        // with Vue components can merge minified bindings and skip DOM runtime initialization.
        optimization: { concatenateModules: false },
      },
    },
  },
}) as RsbuildConfig
