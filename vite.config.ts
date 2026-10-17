import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this app from https://<user>.github.io/hrms/, so
  // every asset reference needs this prefix. Only applies to the production
  // build — `vite dev` ignores `base` for local development.
  base: '/hrms/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    globals: true,
  },
})
