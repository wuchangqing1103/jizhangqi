import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { buildServiceWorkerSource } from './src/lib/sw-template.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

const buildTime = new Date()
const pad = (value: number) => String(value).padStart(2, '0')
// 缓存名带构建时间戳：每次构建换一个，旧缓存由 activate 清理
const cacheStamp = `${buildTime.getFullYear()}${pad(buildTime.getMonth() + 1)}${pad(
  buildTime.getDate(),
)}T${pad(buildTime.getHours())}${pad(buildTime.getMinutes())}`

// public/ 里的文件不进 bundle，需要手动列进预缓存
const PUBLIC_ASSETS = [
  'index.html',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
]

function pwa(): Plugin {
  return {
    name: 'jizhangqi-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const precache = [
        ...new Set([...Object.keys(bundle), ...PUBLIC_ASSETS].filter((name) => !name.endsWith('.map'))),
      ].map((name) => `./${name}`)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: buildServiceWorkerSource({
          cacheName: `jz-${cacheStamp}`,
          precache,
          indexUrl: './index.html',
        }),
      })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), pwa()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(buildTime.toISOString()),
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // DSH 沙箱禁止 fork 子进程，改用 worker 线程跑测试
    pool: 'threads',
  },
})