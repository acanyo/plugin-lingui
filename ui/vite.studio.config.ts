import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5178,
    strictPort: true,
    watch: { usePolling: process.env.LINGUI_USE_POLLING === '1', interval: 300 },
  },
  optimizeDeps: { exclude: ['@lingui/renderer'] },
})
