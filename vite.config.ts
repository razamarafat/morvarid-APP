
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import viteCompression from 'vite-plugin-compression';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json to get version
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
const appVersion = packageJson.version;

// Custom plugin to generate version.json
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
  const env = loadEnv(mode, process.cwd(), '');

  // Detect deployment target
  const isCloudflare = process.env.CF_PAGES === '1' || process.env.DEPLOY_TARGET === 'cloudflare';
  const isGitHub = process.env.GITHUB_ACTIONS === 'true' || process.env.DEPLOY_TARGET === 'github';
  const isVercel = process.env.VERCEL === '1';

  // Set base path based on deployment target
  let basePath = '/';
  if (isGitHub) {
    basePath = '/morvarid-APP/';
  } else if (isCloudflare || isVercel) {
    basePath = '/';
  } else if (mode === 'production' && !isCloudflare && !isVercel) {
    // Default to GitHub Pages path for production if not explicitly Cloudflare or Vercel
    basePath = '/morvarid-APP/';
  }

  console.log(`[Build] Deployment target: ${isCloudflare ? 'Cloudflare Pages' : isGitHub ? 'GitHub Pages' : 'Development'}`);
  console.log(`[Build] Base path: ${basePath}`);

  return {
    define: {
      '__APP_VERSION__': JSON.stringify(appVersion),
      // Make VAPID key available in SW
      'process.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(env.VITE_VAPID_PUBLIC_KEY),
    },
    plugins: [
      react(),
      viteCompression(),
      generateVersionFile(),
      VitePWA({
        registerType: 'autoUpdate',
        updateViaCache: 'none',
        injectRegister: false,
        selfDestroying: false,
        strategies: 'injectManifest',
        srcDir: 'public',
        srcFile: 'sw.js',
        outDir: 'dist',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webp}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
        workbox: {
          mode: 'production',
          inlineWorkboxRuntime: false,
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
        manifest: {
          name: 'Morvarid App',
          short_name: 'Morvarid',
          description: 'Morvarid Application for farm management.',
          theme_color: '#ffffff',
          icons: [
            {
              src: 'icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    base: basePath,
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rollupOptions: {},
    },
  };
});
