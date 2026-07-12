import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const productionOutput = fileURLToPath(
  new URL('../../assets/software-construction-quest', import.meta.url),
);

export default defineConfig({
  base: '/assets/software-construction-quest/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  server: {
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {
    outDir: productionOutput,
    emptyOutDir: true,
    sourcemap: true,
    cssCodeSplit: false,
    // Three.js and the custom renderer live in one lazy chunk; the app-specific
    // mission entry remains below 25 kB gzip and never waits for this payload.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      output: {
        entryFileNames: 'software-construction-quest.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'software-construction-quest[extname]',
        manualChunks(moduleId) {
          return /\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)
            ? 'react-vendor'
            : undefined;
        },
      },
    },
  },
});
