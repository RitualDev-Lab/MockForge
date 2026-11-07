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
      external: [
        /^node:/,
        /^@modelcontextprotocol/,
        /^zod/,
        'fs',
        'path',
        'crypto',
        'util',
        'os',
        'stream',
        'events',
        'http',
        'url',
        'readline'
      ]
    }
  }
});
