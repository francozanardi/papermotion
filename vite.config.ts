import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5299 },
  test: { include: ['tests/**/*.test.ts'] },
});
