import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['js/**/*.js'],
      exclude: [
        'js/services/api/mockData.js',
        'tests/**',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
});
