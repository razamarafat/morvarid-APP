
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import viteCompression from 'vite-plugin-compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;

// Custom plugin to generate version.json and inject VAPID key
const generateVersionFile = () => {
  return {
    name: 'generate-version-file',
    writeBundle() {
      const versionInfo = {
        buildDate: Date.now(),
        version: appVersion
      };
      const filePath = path.resolve(__dirname, 'dist', 'version.json');
      if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
        fs.writeFileSync(filePath, JSON.stringify(versionInfo));
        console.log(`[Version] version.json generated: ${JSON.stringify(versionInfo)}`);
      }

      // Inject VAPID key into service worker
      const swPath = path.resolve(__dirname, 'dist', 'sw.js');
      if (fs.existsSync(swPath)) {
        let swContent = fs.readFileSync(swPath, 'utf-8');
        const vapidKey = process.env.VITE_VAPID_PUBLIC_KEY;
        if (vapidKey) {
          swContent = swContent.replace('__VITE_VAPID_PUBLIC_KEY__', vapidKey);
          console.log('[Build] VAPID key injected into service worker');
        } else {
          console.warn('[Build] VAPID key not found in environment variables');
        }
        fs.writeFileSync(swPath, swContent);
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/version.json') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ buildDate: Date.now(), version: appVersion + '-dev' }));
          return;
        }
        next();
      });
    }
  };
};

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    // Expose the version as a global constant using __APP_VERSION__
    define: {
      '__APP_VERSION__': JSON.stringify(appVersion),
    },
    plugins: [
      react(),
      generateVersionFile(),
      viteCompression() // Enable Gzip compression
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: './',
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-utils': ['zustand', 'date-fns', 'date-fns-jalali', 'uuid', 'zod', 'react-hook-form'],
            'vendor-ui': ['framer-motion', 'lucide-react', 'react-window', 'react-virtualized-auto-sizer'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-exceljs': ['exceljs'],
          }
        }
      }
    },
  };
});
