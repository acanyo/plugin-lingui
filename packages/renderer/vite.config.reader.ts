import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { 'ci-info': fileURLToPath(new URL('./src/openui/browser-environment.ts', import.meta.url)) } },
  build: {
    outDir: '../../ui/build/reader',
    emptyOutDir: true,
    lib: {
      entry: 'src/browser.ts',
      name: 'LinguiReader',
      fileName: () => 'lingui-reader.js',
      cssFileName: 'lingui-reader',
      formats: ['iife'],
    },
    minify: 'terser',
  },
})
