import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

/**
 * Stamps the build so a device can say which version it is running — the one
 * question a cached PWA cannot otherwise answer.
 */
const buildId = (): string => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'dev';
  }
};
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the built app can be served from any path (a subfolder on a
// static host, a local file server) — routing is hash-based for the same reason.
export default defineConfig({
  base: './',
  define: {
    __APP_BUILD__: JSON.stringify(buildId()),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'CellarBook — wine cellar & diary',
        short_name: 'CellarBook',
        description:
          'Track the wine in your cellar, log what you drink, and see the statistics behind both.',
        theme_color: '#16110f',
        background_color: '#16110f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The Anthropic SDK chunk is comfortably under this.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
});
