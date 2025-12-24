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
        version: process.env.npm_package_version || '2.1.0'
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
    chunkSizeWarningLimit: 1600,
  },
});