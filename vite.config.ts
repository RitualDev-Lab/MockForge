import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'esnext',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MockForge',
      fileName: 'index',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      external: ['node:fs', 'node:path', 'node:crypto', 'node:util']
    }
  }
});
