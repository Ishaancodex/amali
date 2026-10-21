import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Scenario and comms tests rebuild the full seed and fan out to ~420 residents; they take
    // ~1.5s alone but can pass the 5s default when every file runs in parallel on a busy machine.
    testTimeout: 20000,
    include: ['tests/unit/**/*.test.ts', 'tests/scenarios/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
