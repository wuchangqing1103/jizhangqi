export interface ServiceWorkerConfig {
  cacheName: string
  /** 构建产物 + 图标 + manifest，全部是 ./ 开头的相对路径 */
  precache: string[]
  /** 导航失败时回退的页面，一般是 './index.html' */
  indexUrl: string
}

/**
 * 生成 sw.js 源码：把缓存名、预缓存列表、首页地址注入到技术方案的骨架里。
 * 纯函数，构建脚本和单测共用。
 */
export function buildServiceWorkerSource({
  cacheName,
  precache,
  indexUrl,
}: ServiceWorkerConfig): string {
  return `const CACHE = ${JSON.stringify(cacheName)}
const PRECACHE = ${JSON.stringify(precache, null, 2)}
const INDEX = ${JSON.stringify(indexUrl)}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    // 页面导航：网络优先。缓存优先会在发版后先把旧 index.html 顶上来，
    // 而旧 HTML 里引用的 assets 已经被新版本替换（旧文件 404），结果是整页白屏打不开。
    // 网络正常时顺手把最新页面写回缓存，断网时仍能打开。
    event.respondWith(
      // no-store：GitHub Pages 给 index.html 的 max-age=600，绕开 HTTP 缓存才能拿到刚部署的页面
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone()
            caches.open(CACHE).then((cache) => cache.put(INDEX, copy))
          }
          return response
        })
        .catch(() => caches.match(INDEX)),
    )
    return
  }

  // 同源静态资源：缓存优先，未命中再请求网络
  event.respondWith(caches.match(request).then((hit) => hit || fetch(request)))
})
`
}