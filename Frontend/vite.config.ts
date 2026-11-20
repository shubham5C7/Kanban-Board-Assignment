import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
          if (/node_modules\/@dnd-kit\//.test(id)) return 'drag-vendor';
          if (/node_modules\/lucide-react\//.test(id)) return 'icons-vendor';
          if (/node_modules\/@google\/genai\//.test(id)) return 'ai-vendor';
          return 'vendor';
        },
      },
    },
  },
});
