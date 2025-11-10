import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,
    // Exclude MongoDB-related tests (MongoDB has been removed from the project)
    exclude: [
      ...configDefaults.exclude,
      '**/mongodb.test.js',
      '**/mongo-lock.test.js',
      '**/validate-mongo-uri.test.js'
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**'],
      exclude: [
        ...configDefaults.exclude,
        'coverage',
        // Exclude MongoDB files from coverage
        '**/mongodb.js',
        '**/mongo-lock.js',
        '**/validate-mongo-uri.js'
      ]
    },
    setupFiles: ['.vite/setup-files.js']
  }
})
