/// <reference types="vitest" />
import { coverageConfigDefaults, defineConfig } from 'vitest/config'
import { mergeConfig } from 'vite'

import viteConfig from './vite.config'

// https://vitejs.dev/config/
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      clearMocks: true,
      setupFiles: './src/setupTests.ts',
      server: {
        deps: {
          inline: ['vitest-canvas-mock'],
        },
      },
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: [
          ...coverageConfigDefaults.exclude,
          'node_modules/',
          'src/setupTests.ts',
          '**/.storybook/**',
          '**/*.stories.*',
          '**/storybook-static/**',
        ],
      },
    },
  })
)
