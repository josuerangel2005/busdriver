import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // RTDB compat registers on the hoisted app-compat, not Firebase's nested copy.
      'firebase/compat/app': '@firebase/app-compat',
    },
  },
  test: {
    server: {
      // Let Vite apply the alias to the rules library's internal import.
      deps: { inline: ['@firebase/rules-unit-testing'] },
    },
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
