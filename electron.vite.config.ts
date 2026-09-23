import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve('apps/desktop/src/main/index.ts')
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
    resolve: {
      alias: {
        '@renderer': resolve('apps/desktop/src/renderer/src')
      }
    }
  }
})
