import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: 'src/client/main.jsx',
      output: {
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (asset) => (asset.names.some((n) => n.endsWith('.css')) ? 'assets/app[extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
