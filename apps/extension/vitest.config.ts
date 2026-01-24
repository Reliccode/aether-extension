import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    cacheDir: './.vitest-cache',
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['tests/setup/vitest.setup.ts'],
    coverage: { provider: 'v8' },
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**']
  }
});
