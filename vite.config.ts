
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Custom plugin to generate version.json
const generateVersionFile = () => {
  return {
    name: 'generate-version-file',
    writeBundle() {
      const versionInfo = {
        buildDate: Date.now(),
        version: process.env.npm_package_version || '2.7.0'
      };
      const filePath = path.resolve(__dirname, 'dist', 'version.json');
      // Ensure dist folder exists (it should after build)
      if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
          fs.writeFileSync(filePath, JSON.stringify(versionInfo));
          console.log(`[Version] version.json generated: ${JSON.stringify(versionInfo)}`);
      }
    },
    configureServer(server) {
       // Mock version.json for dev server
       server.middlewares.use((req, res, next) => {
           if (req.url === '/version.json') {
               res.setHeader('Content-Type', 'application/json');
               res.end(JSON.stringify({ buildDate: Date.now(), version: 'dev' }));
               return;
           }
           next();
       });
    }
  };
};

export default defineConfig({
  plugins: [react(), generateVersionFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  base: './', 
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 1000, // Reduced warning limit to encourage splitting
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management & Utilities
          'vendor-utils': ['zustand', 'date-fns', 'date-fns-jalali', 'uuid', 'zod', 'react-hook-form'],
          // Heavy UI libraries
          'vendor-ui': ['framer-motion', 'lucide-react', 'react-window', 'react-virtualized-auto-sizer'],
          // Supabase (Large library)
          'vendor-supabase': ['@supabase/supabase-js'],
          // Excel processing (Very large, separate it)
          'vendor-xlsx': ['xlsx'],
        }
      }
    }
  },
});
