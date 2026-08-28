import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@database': path.resolve(__dirname, 'src/database'),
      '@models': path.resolve(__dirname, 'src/models'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@controllers': path.resolve(__dirname, 'src/controllers'),
      '@middleware': path.resolve(__dirname, 'src/middleware'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], coverage: { reporter: ['text', 'json-summary'] } },
});
