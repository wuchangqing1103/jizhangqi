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

  it('导航请求网络优先，断网时回退缓存', () => {
    expect(source).toContain("if (request.mode === 'navigate')")
    expect(source).toContain('cache.put(INDEX, copy)')
    expect(source).toContain('.catch(() => caches.match(INDEX))')

    // 先问网络：发版后旧 index.html 引用的资源已 404，缓存优先会白屏
    const navigate = source.slice(source.indexOf("if (request.mode === 'navigate')"))
    expect(navigate.indexOf('fetch(request')).toBeLessThan(navigate.indexOf('caches.match(INDEX)'))
    expect(navigate).not.toContain('if (cached) return cached')
    // 绕开 HTTP 缓存，否则刚部署的页面可能被 max-age 挡住
    expect(navigate).toContain("cache: 'no-store'")
  })

  it('网络返回非 2xx 时不写缓存，避免把错误页烤进缓存', () => {
    expect(source).toContain('if (response && response.ok)')
  })
})