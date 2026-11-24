import { defineConfig } from 'vite';

// Builds the SDK for use outside this repo: an ES module, and a single script file for <script> tags.
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VidCraft',
      formats: ['es', 'iife'],
      fileName: (format) => `vidcraft.${format}.js`,
    },
    sourcemap: true,
    minify: true,
  },
});
