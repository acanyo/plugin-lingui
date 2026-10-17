import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [svelte()],
  resolve: { alias: { 'ci-info': fileURLToPath(new URL('./src/openui/browser-environment.ts', import.meta.url)) } },
  build: {
    lib: { entry: 'src/index.ts', name: 'LinguiRenderer', fileName: 'lingui-renderer', formats: ['es', 'iife'] },
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: { compress: { drop_console: true }, format: { comments: false } },
    rollupOptions: { output: { extend: true } },
  },
})
