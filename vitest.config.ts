import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './client/src/test/setup.ts',
    include: ['**/*.test.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      // Use regex for CSS mocking
    },
  },
  resolve: {
    alias: [{ find: /.*\.css$/, replacement: path.resolve(__dirname, './client/src/test/style-mock.js') }],
  }
});
