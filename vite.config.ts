import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  css: {
    // This should be enabled by default, but just in case
    modules: false
  },
  assetsInclude: ['**/*.css'], // If needed
  plugins: [
    svelte({
      compilerOptions: {
        customElement: false,
      },
    }),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'WebTreeView',
      formats: ['es', 'umd'],
      fileName: (format) => `web-treeview.${format === 'es' ? 'js' : 'umd.js'}`,
    },
    rollupOptions: {
      external: [],
      output: {
        globals: {},
      },
    },
    sourcemap: true,
  },
});