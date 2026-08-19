import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { gitApiPlugin } from './vite-plugin-git.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), gitApiPlugin()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts'
  }
})
