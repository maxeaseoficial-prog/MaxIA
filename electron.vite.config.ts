import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('apps/desktop/src/main/index.ts'),
          'workers/ai-worker': resolve('apps/desktop/src/main/workers/ai-worker.ts')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('apps/desktop/src/main/preload.ts')
      }
    }
  },
  renderer: {
    root: resolve('apps/desktop/src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve('apps/desktop/src/renderer/index.html')
      }
    },
    resolve: {
      alias: {
        '@renderer': resolve('apps/desktop/src/renderer/src')
      }
    }
  }
})
