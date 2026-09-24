import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'node22',
    outDir: 'dist',
    ssr: true,
    rollupOptions: {
      input: {
        index: 'src/index.ts',
        worker: 'src/worker.ts',
      },
    },
  },
})
