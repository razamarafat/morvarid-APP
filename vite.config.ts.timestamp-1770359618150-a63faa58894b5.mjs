// vite.config.ts
import { defineConfig, loadEnv } from "file:///C:/Users/Reza/Documents/GitHub/Morvarid-APP/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Reza/Documents/GitHub/Morvarid-APP/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Reza/Documents/GitHub/Morvarid-APP/node_modules/vite-plugin-pwa/dist/index.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import viteCompression from "file:///C:/Users/Reza/Documents/GitHub/Morvarid-APP/node_modules/vite-plugin-compression/dist/index.mjs";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Reza/Documents/GitHub/Morvarid-APP/vite.config.ts";
var __filename = fileURLToPath(__vite_injected_original_import_meta_url);
var __dirname = path.dirname(__filename);
var packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
var appVersion = packageJson.version;
var generateVersionFile = () => {
  return {
    name: "generate-version-file",
    writeBundle() {
      const versionInfo = {
        buildDate: Date.now(),
        version: appVersion
      };
      const filePath = path.resolve(__dirname, "dist", "version.json");
      if (fs.existsSync(path.resolve(__dirname, "dist"))) {
        fs.writeFileSync(filePath, JSON.stringify(versionInfo));
        console.log(`[Version] version.json generated: ${JSON.stringify(versionInfo)}`);
      }
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/version.json") {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ buildDate: Date.now(), version: appVersion + "-dev" }));
          return;
        }
        next();
      });
    }
  };
};
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isCloudflare = process.env.CF_PAGES === "1" || process.env.DEPLOY_TARGET === "cloudflare";
  const isGitHub = process.env.GITHUB_ACTIONS === "true" || process.env.DEPLOY_TARGET === "github";
  const isVercel = process.env.VERCEL === "1";
  let basePath = "/";
  if (isGitHub) {
    basePath = "/morvarid-APP/";
  } else if (isCloudflare || isVercel) {
    basePath = "/";
  } else if (mode === "production" && !isCloudflare && !isVercel) {
    basePath = "/morvarid-APP/";
  }
  console.log(`[Build] Deployment target: ${isCloudflare ? "Cloudflare Pages" : isGitHub ? "GitHub Pages" : "Development"}`);
  console.log(`[Build] Base path: ${basePath}`);
  return {
    define: {
      "__APP_VERSION__": JSON.stringify(appVersion),
      // Make VAPID key available in SW
      "process.env.VITE_VAPID_PUBLIC_KEY": JSON.stringify(env.VITE_VAPID_PUBLIC_KEY)
    },
    plugins: [
      react(),
      viteCompression(),
      generateVersionFile(),
      VitePWA({
        registerType: "autoUpdate",
        updateViaCache: "none",
        injectRegister: false,
        selfDestroying: false,
        strategies: "injectManifest",
        srcDir: "public",
        srcFile: "sw.js",
        outDir: "dist",
        filename: "sw.js",
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,json,webp}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
        },
        workbox: {
          mode: "production",
          inlineWorkboxRuntime: false,
          cleanupOutdatedCaches: true
        },
        devOptions: {
          enabled: true,
          type: "module",
          navigateFallback: "index.html"
        },
        manifest: {
          name: "Morvarid App",
          short_name: "Morvarid",
          description: "Morvarid Application for farm management.",
          theme_color: "#ffffff",
          icons: [
            {
              src: "icons/icon-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "icons/icon-512x512.png",
              sizes: "512x512",
              type: "image/png"
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src")
      }
    },
    base: basePath,
    build: {
      outDir: "dist",
      sourcemap: false,
      chunkSizeWarningLimit: 1e3,
      rollupOptions: {}
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxSZXphXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcTW9ydmFyaWQtQVBQXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxSZXphXFxcXERvY3VtZW50c1xcXFxHaXRIdWJcXFxcTW9ydmFyaWQtQVBQXFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9SZXphL0RvY3VtZW50cy9HaXRIdWIvTW9ydmFyaWQtQVBQL3ZpdGUuY29uZmlnLnRzXCI7XHJcbmltcG9ydCB7IGRlZmluZUNvbmZpZywgbG9hZEVudiB9IGZyb20gJ3ZpdGUnO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJztcclxuaW1wb3J0IHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCBmcyBmcm9tICdmcyc7XHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnO1xyXG5pbXBvcnQgdml0ZUNvbXByZXNzaW9uIGZyb20gJ3ZpdGUtcGx1Z2luLWNvbXByZXNzaW9uJztcclxuXHJcbmNvbnN0IF9fZmlsZW5hbWUgPSBmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCk7XHJcbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShfX2ZpbGVuYW1lKTtcclxuXHJcbi8vIFJlYWQgcGFja2FnZS5qc29uIHRvIGdldCB2ZXJzaW9uXHJcbmNvbnN0IHBhY2thZ2VKc29uID0gSlNPTi5wYXJzZShmcy5yZWFkRmlsZVN5bmMoJy4vcGFja2FnZS5qc29uJywgJ3V0Zi04JykpO1xyXG5jb25zdCBhcHBWZXJzaW9uID0gcGFja2FnZUpzb24udmVyc2lvbjtcclxuXHJcbi8vIEN1c3RvbSBwbHVnaW4gdG8gZ2VuZXJhdGUgdmVyc2lvbi5qc29uXHJcbmNvbnN0IGdlbmVyYXRlVmVyc2lvbkZpbGUgPSAoKSA9PiB7XHJcbiAgcmV0dXJuIHtcclxuICAgIG5hbWU6ICdnZW5lcmF0ZS12ZXJzaW9uLWZpbGUnLFxyXG4gICAgd3JpdGVCdW5kbGUoKSB7XHJcbiAgICAgIGNvbnN0IHZlcnNpb25JbmZvID0ge1xyXG4gICAgICAgIGJ1aWxkRGF0ZTogRGF0ZS5ub3coKSxcclxuICAgICAgICB2ZXJzaW9uOiBhcHBWZXJzaW9uXHJcbiAgICAgIH07XHJcbiAgICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2Rpc3QnLCAndmVyc2lvbi5qc29uJyk7XHJcbiAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JykpKSB7XHJcbiAgICAgICAgZnMud3JpdGVGaWxlU3luYyhmaWxlUGF0aCwgSlNPTi5zdHJpbmdpZnkodmVyc2lvbkluZm8pKTtcclxuICAgICAgICBjb25zb2xlLmxvZyhgW1ZlcnNpb25dIHZlcnNpb24uanNvbiBnZW5lcmF0ZWQ6ICR7SlNPTi5zdHJpbmdpZnkodmVyc2lvbkluZm8pfWApO1xyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKChyZXEsIHJlcywgbmV4dCkgPT4ge1xyXG4gICAgICAgIGlmIChyZXEudXJsID09PSAnL3ZlcnNpb24uanNvbicpIHtcclxuICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgYnVpbGREYXRlOiBEYXRlLm5vdygpLCB2ZXJzaW9uOiBhcHBWZXJzaW9uICsgJy1kZXYnIH0pKTtcclxuICAgICAgICAgIHJldHVybjtcclxuICAgICAgICB9XHJcbiAgICAgICAgbmV4dCgpO1xyXG4gICAgICB9KTtcclxuICAgIH1cclxuICB9O1xyXG59O1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xyXG4gIGNvbnN0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSwgJycpO1xyXG5cclxuICAvLyBEZXRlY3QgZGVwbG95bWVudCB0YXJnZXRcclxuICBjb25zdCBpc0Nsb3VkZmxhcmUgPSBwcm9jZXNzLmVudi5DRl9QQUdFUyA9PT0gJzEnIHx8IHByb2Nlc3MuZW52LkRFUExPWV9UQVJHRVQgPT09ICdjbG91ZGZsYXJlJztcclxuICBjb25zdCBpc0dpdEh1YiA9IHByb2Nlc3MuZW52LkdJVEhVQl9BQ1RJT05TID09PSAndHJ1ZScgfHwgcHJvY2Vzcy5lbnYuREVQTE9ZX1RBUkdFVCA9PT0gJ2dpdGh1Yic7XHJcbiAgY29uc3QgaXNWZXJjZWwgPSBwcm9jZXNzLmVudi5WRVJDRUwgPT09ICcxJztcclxuXHJcbiAgLy8gU2V0IGJhc2UgcGF0aCBiYXNlZCBvbiBkZXBsb3ltZW50IHRhcmdldFxyXG4gIGxldCBiYXNlUGF0aCA9ICcvJztcclxuICBpZiAoaXNHaXRIdWIpIHtcclxuICAgIGJhc2VQYXRoID0gJy9tb3J2YXJpZC1BUFAvJztcclxuICB9IGVsc2UgaWYgKGlzQ2xvdWRmbGFyZSB8fCBpc1ZlcmNlbCkge1xyXG4gICAgYmFzZVBhdGggPSAnLyc7XHJcbiAgfSBlbHNlIGlmIChtb2RlID09PSAncHJvZHVjdGlvbicgJiYgIWlzQ2xvdWRmbGFyZSAmJiAhaXNWZXJjZWwpIHtcclxuICAgIC8vIERlZmF1bHQgdG8gR2l0SHViIFBhZ2VzIHBhdGggZm9yIHByb2R1Y3Rpb24gaWYgbm90IGV4cGxpY2l0bHkgQ2xvdWRmbGFyZSBvciBWZXJjZWxcclxuICAgIGJhc2VQYXRoID0gJy9tb3J2YXJpZC1BUFAvJztcclxuICB9XHJcblxyXG4gIGNvbnNvbGUubG9nKGBbQnVpbGRdIERlcGxveW1lbnQgdGFyZ2V0OiAke2lzQ2xvdWRmbGFyZSA/ICdDbG91ZGZsYXJlIFBhZ2VzJyA6IGlzR2l0SHViID8gJ0dpdEh1YiBQYWdlcycgOiAnRGV2ZWxvcG1lbnQnfWApO1xyXG4gIGNvbnNvbGUubG9nKGBbQnVpbGRdIEJhc2UgcGF0aDogJHtiYXNlUGF0aH1gKTtcclxuXHJcbiAgcmV0dXJuIHtcclxuICAgIGRlZmluZToge1xyXG4gICAgICAnX19BUFBfVkVSU0lPTl9fJzogSlNPTi5zdHJpbmdpZnkoYXBwVmVyc2lvbiksXHJcbiAgICAgIC8vIE1ha2UgVkFQSUQga2V5IGF2YWlsYWJsZSBpbiBTV1xyXG4gICAgICAncHJvY2Vzcy5lbnYuVklURV9WQVBJRF9QVUJMSUNfS0VZJzogSlNPTi5zdHJpbmdpZnkoZW52LlZJVEVfVkFQSURfUFVCTElDX0tFWSksXHJcbiAgICB9LFxyXG4gICAgcGx1Z2luczogW1xyXG4gICAgICByZWFjdCgpLFxyXG4gICAgICB2aXRlQ29tcHJlc3Npb24oKSxcclxuICAgICAgZ2VuZXJhdGVWZXJzaW9uRmlsZSgpLFxyXG4gICAgICBWaXRlUFdBKHtcclxuICAgICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcclxuICAgICAgICB1cGRhdGVWaWFDYWNoZTogJ25vbmUnLFxyXG4gICAgICAgIGluamVjdFJlZ2lzdGVyOiBmYWxzZSxcclxuICAgICAgICBzZWxmRGVzdHJveWluZzogZmFsc2UsXHJcbiAgICAgICAgc3RyYXRlZ2llczogJ2luamVjdE1hbmlmZXN0JyxcclxuICAgICAgICBzcmNEaXI6ICdwdWJsaWMnLFxyXG4gICAgICAgIHNyY0ZpbGU6ICdzdy5qcycsXHJcbiAgICAgICAgb3V0RGlyOiAnZGlzdCcsXHJcbiAgICAgICAgZmlsZW5hbWU6ICdzdy5qcycsXHJcbiAgICAgICAgaW5qZWN0TWFuaWZlc3Q6IHtcclxuICAgICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyxqc29uLHdlYnB9J10sXHJcbiAgICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgd29ya2JveDoge1xyXG4gICAgICAgICAgbW9kZTogJ3Byb2R1Y3Rpb24nLFxyXG4gICAgICAgICAgaW5saW5lV29ya2JveFJ1bnRpbWU6IGZhbHNlLFxyXG4gICAgICAgICAgY2xlYW51cE91dGRhdGVkQ2FjaGVzOiB0cnVlLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgZGV2T3B0aW9uczoge1xyXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcclxuICAgICAgICAgIHR5cGU6ICdtb2R1bGUnLFxyXG4gICAgICAgICAgbmF2aWdhdGVGYWxsYmFjazogJ2luZGV4Lmh0bWwnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICAgIG5hbWU6ICdNb3J2YXJpZCBBcHAnLFxyXG4gICAgICAgICAgc2hvcnRfbmFtZTogJ01vcnZhcmlkJyxcclxuICAgICAgICAgIGRlc2NyaXB0aW9uOiAnTW9ydmFyaWQgQXBwbGljYXRpb24gZm9yIGZhcm0gbWFuYWdlbWVudC4nLFxyXG4gICAgICAgICAgdGhlbWVfY29sb3I6ICcjZmZmZmZmJyxcclxuICAgICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICdpY29ucy9pY29uLTE5MngxOTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBzcmM6ICdpY29ucy9pY29uLTUxMng1MTIucG5nJyxcclxuICAgICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgIF1cclxuICAgICAgICB9XHJcbiAgICAgIH0pXHJcbiAgICBdLFxyXG4gICAgcmVzb2x2ZToge1xyXG4gICAgICBhbGlhczoge1xyXG4gICAgICAgICdAJzogcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJy4vc3JjJyksXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgYmFzZTogYmFzZVBhdGgsXHJcbiAgICBidWlsZDoge1xyXG4gICAgICBvdXREaXI6ICdkaXN0JyxcclxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcclxuICAgICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiAxMDAwLFxyXG4gICAgICByb2xsdXBPcHRpb25zOiB7fSxcclxuICAgIH0sXHJcbiAgfTtcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLGNBQWMsZUFBZTtBQUN0QyxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFDZixTQUFTLHFCQUFxQjtBQUM5QixPQUFPLHFCQUFxQjtBQVA2SyxJQUFNLDJDQUEyQztBQVMxUCxJQUFNLGFBQWEsY0FBYyx3Q0FBZTtBQUNoRCxJQUFNLFlBQVksS0FBSyxRQUFRLFVBQVU7QUFHekMsSUFBTSxjQUFjLEtBQUssTUFBTSxHQUFHLGFBQWEsa0JBQWtCLE9BQU8sQ0FBQztBQUN6RSxJQUFNLGFBQWEsWUFBWTtBQUcvQixJQUFNLHNCQUFzQixNQUFNO0FBQ2hDLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFDWixZQUFNLGNBQWM7QUFBQSxRQUNsQixXQUFXLEtBQUssSUFBSTtBQUFBLFFBQ3BCLFNBQVM7QUFBQSxNQUNYO0FBQ0EsWUFBTSxXQUFXLEtBQUssUUFBUSxXQUFXLFFBQVEsY0FBYztBQUMvRCxVQUFJ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
