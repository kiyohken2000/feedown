import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // api.spec.ts adds real feeds; the server allows each feed fetch 10 s
    testTimeout: 20000,
  },
});
