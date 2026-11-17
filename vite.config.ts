import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // index.html 永远走网络，避免用户被旧版锁定
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // 页面导航：网络优先，断网才回退缓存
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        name: '定投记录',
        short_name: '定投',
        description: '每月 500 元 VGT 定投纪律执行器',
        lang: 'zh-CN',
        dir: 'ltr',
        theme_color: '#0e2439',
        background_color: '#f4f1ea',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: './',
        scope: './',
        categories: ['finance', 'productivity'],
        icons: [
          // 安卓需要 PNG；192/512 是 Chrome 安装的必要条件
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          // maskable 让图标适配安卓自适应形状，不被裁掉
          { src: 'icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: '现金池', short_name: '现金', url: './#cash', description: '看三处余额与覆盖率' },
          { name: '持仓', short_name: '持仓', url: './#position', description: '看成本价与浮盈亏' },
        ],
      }
    })
  ]
})
