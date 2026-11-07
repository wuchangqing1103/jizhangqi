import { describe, expect, it } from 'vitest'
import { buildServiceWorkerSource } from './sw-template'

const source = buildServiceWorkerSource({
  cacheName: 'jz-20261107T1650',
  precache: ['./index.html', './assets/index-abc.js', './icons/icon-192.png'],
  indexUrl: './index.html',
})

describe('buildServiceWorkerSource', () => {
  it('注入缓存名、预缓存列表与首页地址', () => {
    expect(source).toContain('const CACHE = "jz-20261107T1650"')
    expect(source).toContain('const INDEX = "./index.html"')
    expect(source).toContain('"./assets/index-abc.js"')
    expect(source).toContain('"./icons/icon-192.png"')
  })

  it('不残留未替换的占位符', () => {
    expect(source).not.toMatch(/__[A-Z_]+__/)
  })

  it('注册 install / activate / fetch 三个监听器', () => {
    expect(source).toContain("addEventListener('install'")
    expect(source).toContain("addEventListener('activate'")
    expect(source).toContain("addEventListener('fetch'")
    expect(source).toContain('self.skipWaiting()')
    expect(source).toContain('self.clients.claim()')
  })

  it('非 GET 与跨域请求直接放行', () => {
    expect(source).toContain("if (request.method !== 'GET') return")
    expect(source).toContain('if (url.origin !== self.location.origin) return')
  })

  it('导航请求网络优先，失败回退缓存的首页', () => {
    expect(source).toContain("if (request.mode === 'navigate')")
    expect(source).toContain('cache.put(INDEX, copy)')
    expect(source).toContain('caches.match(INDEX)')
  })
})