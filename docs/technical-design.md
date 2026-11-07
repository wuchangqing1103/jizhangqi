# 记账器 · 技术方案（PWA 交付版）

> 状态：待评审　·　日期：2026-11-07　·　基线：`fa4d5fa`
> 上游文档：[产品设计](product-design.md)

## 1. 目标与范围

产品侧已定：单用户轻量记账，手机优先，MVP 只做记一笔 / 账单流 / 月度统计 / 编辑删除 / 本地持久化。本文只解决**「怎么把它变成一个 iPhone 上能长期用的东西」**，不扩展功能。

验收目标（来自 m00074 的口径）：

1. iPhone 上像 App 一样用：主屏图标、全屏无地址栏、`3 秒记一笔` 的路径不被浏览器界面打断；
2. **离开电脑也能用**：电脑关机、不连 Wi-Fi、只有流量甚至飞行模式，都能打开并记账；
3. 部署后手机首次安装需联网，之后离线可用；升级只需重新部署，无需 App Store。

明确不做：登录、云同步、多账本、预算、OCR、CSV 导出、桌面打包（Electron/Tauri）。

## 2. 技术选型

### 2.1 结论

| 层 | 选型 | 理由 |
| --- | --- | --- |
| 视图 | React 19 + TypeScript（沿用） | Demo 已完成，MVP 只验证使用习惯，重写没有收益 |
| 构建 | Vite 8（沿用） | 产物是静态文件，天然适配任意静态托管 |
| 壳 | **PWA**：Web App Manifest + Service Worker | 唯一零安装、零签名、能在 iOS 上「装进主屏并离线运行」的形态 |
| 存储 | `localStorage`（沿用，接口已隔离） | MVP 数据量（每月几十条）远未到瓶颈；抽象层已就位，后续换 IndexedDB/SQLite 不动 UI |
| 打包成原生（备选） | Capacitor | 若日后要真 App（推送、相册、生物识别），同一份 `dist/` 直接包进 WKWebView |

### 2.2 为什么不是 Electron

Electron 只在 Windows / macOS / Linux 有运行时，**手机端没有运行时**，与「手机为主」的硬性要求直接冲突；且 100 MB+ 的壳与「打开到记账 ≤ 5 秒」的产品指标相悖。设计文档已经把需要系统能力的功能全部砍掉（无 OCR、无相册、无通知），Electron 的能力面在这里是纯负债。Tauri 同理，只在「明确要出桌面版」时才值得引入。

### 2.3 为什么不是 React Native / Expo

要重写全部界面与样式，而 MVP 的验证命题是「能否连续记 7 天」，不是「能否做出原生体验」。PWA 保留现有 35 个测试与全部交互，改造成本约两个文件+配置。

## 3. 目标架构

```
┌──────────────── 构建期（vite build） ────────────────┐
│ src/**  ──►  dist/assets/*.[hash].js|css            │
│ index.html ──► dist/index.html                      │
│ public/manifest.json, public/icons/*.png ──► 原样拷贝 │
│ vite 插件 pwa() ──► 读取产物清单，生成 dist/sw.js     │
└─────────────────────────────────────────────────────┘
                          │  上传整个 dist/
                          ▼
┌──────────────── 运行期（手机浏览器 / 主屏 App） ──────┐
│ 首次打开：下载 index.html + js + css + 图标          │
│           sw.js 安装 → 预缓存上述资源 → activate     │
│ 之后每次：SW 拦截请求                               │
│   · 页面导航 → 网络优先，失败回退缓存的 index.html    │
│   · 静态资源 → 缓存优先（文件名含 hash，可永久缓存）  │
│ 数据：localStorage['jizhangqi.v1']（绑域名，不上传）  │
└─────────────────────────────────────────────────────┘
```

关键原则：**Service Worker 只做「让静态壳可离线」，不接管任何业务数据**。账本仍走 `src/lib/storage.ts`，SW 与存储层零耦合。

## 4. 变更清单

全部为新增文件 + 少量配置，**不改业务逻辑**。

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `public/manifest.json` | 新增 | 应用名称、图标、`display: standalone`、主题色 |
| `public/icons/icon-192.png` | 新增 | Android/清单图标（192×192） |
| `public/icons/icon-512.png` | 新增 | 清单图标（512×512） |
| `public/icons/apple-touch-icon.png` | 新增 | iOS 主屏图标（180×180） |
| `scripts/gen-icons.py` | 新增 | 用 Pillow 生成上面三张图（一次性，可重跑） |
| `src/lib/sw-template.ts` | 新增 | 纯函数：`buildServiceWorkerSource({ cacheName, precache, indexUrl })` |
| `src/lib/sw-register.ts` | 新增 | 纯函数：`shouldRegister(env)` + `registerAppShell(deps)`，依赖可注入以便测试 |
| `vite.config.ts` | 修改 | 加 `base: './'` 与 `pwa()` 插件（`generateBundle` 里生成并 emit `sw.js`） |
| `index.html` | 修改 | 加 5 行 meta（见 5.3） |
| `src/main.tsx` | 修改 | 末尾调一次注册（生产环境才真正注册） |
| `src/lib/sw-template.test.ts` | 新增 | 模板生成的内容校验 |
| `src/lib/sw-register.test.ts` | 新增 | 注册条件与参数校验 |
| `src/lib/pwa-assets.test.ts` | 新增 | 校验 manifest 字段与三张图标文件真实存在、尺寸正确 |
| `README.md` | 修改 | 补「装到 iPhone 主屏」「离线验证」「部署」三节 |

不改：`src/lib/storage.ts`、`src/App.tsx` 及全部组件、`src/styles.css`、`src/types.ts`、现有 35 个测试用例、`package.json` 依赖（**不新增任何运行时依赖**）。

## 5. 详细设计

### 5.1 Web App Manifest（`public/manifest.json`）

```json
{
  "name": "记账器",
  "short_name": "记账器",
  "lang": "zh-CN",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#f3f1ec",
  "theme_color": "#f3f1ec",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- `start_url` / `scope` / 图标 `src` **全部用相对路径**：这样挂在根域还是 `https://xxx.github.io/jizhangqi/` 这种子路径都能正确解析，避免「白屏」这一类部署事故。
- `display: standalone` 是 iOS 全屏的前提（配合 5.3 的 `apple-mobile-web-app-capable`）。
- `orientation: portrait` 固定竖屏，与单手记账的交互一致。
- 暂不加 `maskable` 图标（需要四周留安全边距的专用版本，不是 MVP 必需）。

### 5.2 图标

- 三张 PNG，同源设计：**满版墨色底 `#1e1c18` + 居中米白 `¥`（`#f3f1ec`）**，与 App 主色一致；iOS 会自己切圆角，所以不画圆角、不画投影。
- `scripts/gen-icons.py` 用 Pillow 从 1024 母版缩放导出 512 / 192 / 180，避免手改三份。脚本用**工作目录相对路径**调用（`python scripts/gen-icons.py`），不使用绝对中文路径——此前把绝对路径塞进生成脚本出现过编码损坏（`E:\` 被转成乱码导致 `FileNotFoundError`）。
- 图标只影响外观，不满意随时替换，不阻塞功能。

### 5.3 `index.html` 新增 meta

```html
<link rel="manifest" href="manifest.json" />
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="记账器" />
```

- `apple-mobile-web-app-capable` 在本机 Safari 上无任何影响，只在「加入主屏后从主屏启动」时生效（此时没有地址栏/返回键/下拉刷新）。
- 状态栏用 `default`（内容从状态栏下方开始，最稳）；`black-translucent`（沉浸式）留作可选项，需要真机目检后再决定。
- `styles.css` 已在用 `env(safe-area-inset-*)` 与 `100dvh`，无需为全屏改动布局。

### 5.4 Service Worker

**生成方式**：不引第三方插件（`vite-plugin-pwa` 等），在 `vite.config.ts` 里写一个约 30 行的内联插件，在 `generateBundle` 阶段拿到产物清单，调用 `buildServiceWorkerSource()` 生成 `sw.js` 并 `this.emitFile`。

**缓存策略**：

| 请求类型 | 策略 | 说明 |
| --- | --- | --- |
| 页面导航（`request.mode === 'navigate'`） | 网络优先，失败回退缓存 | 保证升级即时生效，断网时仍能打开 |
| 同源静态资源 | 缓存优先，未命中则请求并回填 | 文件名含 content hash，可安全永久缓存 |
| 站外请求 | 直接放行 | 不拦截、不缓存 |
| 非 GET | 直接放行 | 本项目没有写请求 |

**骨架**（`src/lib/sw-template.ts` 输出，`__TOKEN__` 由构建期替换）：

```js
const CACHE = '__CACHE_NAME__'
const PRECACHE = __PRECACHE__
const INDEX = '__INDEX_URL__'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(INDEX, copy))
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(INDEX))),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req)),
  )
})
```

**预缓存清单**：构建产物里所有 `index.html`、`assets/*`、`manifest.json`、三张图标，路径统一加 `./` 前缀（相对 SW 作用域）。

**版本号**：`CACHE = 'jz-' + 构建时间戳`（如 `jz-20261107T1650`）。每次构建都换新缓存名 → `activate` 时清掉旧缓存 → 升级后不会出现新旧资源混用。代价是每次构建全量重下（本项目产物远小于 1 MB，可接受）；换取的是「永远不会因为忘了改版本号而卡在旧版本」。模板函数接受 `cacheName` 入参，因此可单测、可复现。

### 5.5 注册逻辑（`src/lib/sw-register.ts`）

```ts
export function shouldRegister(env: { prod: boolean; hasServiceWorker: boolean }): boolean
export function registerAppShell(deps: {
  register: (url: string, opts?: { scope?: string }) => Promise<unknown>
  baseUrl: string
}): Promise<boolean>
```

- **只在生产构建注册**：`import.meta.env.PROD` 为假（`npm run dev`）时直接返回，避免开发期被旧缓存挡住、改了代码看不到变化。这一条是踩过的坑，写进代码也写进测试。
- 地址：`new URL('sw.js', document.baseURI)`，与 `base: './'` 一致；作用域默认为 SW 所在目录，正好等于部署根路径。
- 注册失败（隐私模式、旧系统、被策略禁止）**静默降级**：记账功能完全不依赖 SW，失败不弹窗、不阻断渲染。

### 5.6 部署形态与 base 路径

- `vite.config.ts` 增加 `base: './'`：产物里所有资源引用变为相对路径，同一个 `dist/` 无论部署在域名根目录还是子目录都能跑，无需为不同托管改配置。
- 代价：若将来加前端路由（多级 URL），相对 base 会失效，届时改回显式 base（如 `/jizhangqi/`）并配 SPA 回退。当前是单页状态切换，没有这个约束。
- 因此**部署物 = `dist/` 目录整体**，不含构建步骤、不需要 Node 环境。

## 6. 数据与存储

现状已满足要求，本方案不修改：

- `src/lib/storage.ts` 暴露 `readLedger / writeLedger / removeLedger`，键名 `jizhangqi.v1`，读取结果三态（`missing / ok / invalid`），异常一律降级不抛错；
- 金额以「分」为整数存储，规避浮点误差。

需要写进用户文档的事实与风险：

1. 数据存在 **Safari 的 localStorage，绑定域名**；换域名、清网站数据、换手机都不迁移。
2. 加到主屏后由独立入口使用；**建议固定从主屏进入记账**，避免在 Safari 与主屏两个入口间混用产生两套数据。
3. iOS 在存储紧张时可能回收站点数据，属小概率但不可逆 → 因此把 **「导出 / 导入 JSON」** 作为强建议项（比原规划的 CSV 更简单，半小时量级）；是否纳入本期见 §11。
4. 换托管域名等于换数据孤岛，**安装前应先把最终域名定下来**，不要用临时隧道装一次、之后再换正式域名。

升级路径（不本期做）：`storage.ts` 内部换成 IndexedDB 实现，键名与 payload 结构保持不变，一次性迁移；若日后接云同步，只在这一层加一层同步适配器，UI 与组件不动。

## 7. 测试方案

| 文件 | 覆盖点 |
| --- | --- |
| `src/lib/sw-template.test.ts` | 生成的源码包含注入的缓存名/预缓存清单/index 地址；不含未替换的 `__TOKEN__`；`install`/`activate`/`fetch` 三个监听器齐全；非 GET 与跨域分支存在 |
| `src/lib/sw-register.test.ts` | 非生产环境不调用 `register`；生产环境调用一次且 URL 为 `sw.js`；`register` 抛错时返回 `false` 且不抛 |
| `src/lib/pwa-assets.test.ts` | `manifest.json` 可解析、`display === 'standalone'`、字段为相对路径；三张图标文件存在且 PNG 头声明的尺寸与文件名一致 |

- 三个测试都是**纯函数 / 文件系统校验**，不模拟 Service Worker 运行时（jsdom 里没有 SW，硬造只会得到假绿）。
- 现有 35 个用例不改；`npm test` 全量通过 + `npm run build` 成功 + `tsc --noEmit` 无错，作为交付前置条件。
- 人工验收部分（自动化测不到）：`npm run build && npm run preview` → 打开一次 → DevTools 切 Offline → 刷新仍能记账；真机装主屏后飞行模式复测。

## 8. 部署方案

技术上的硬约束只有一条：**必须是 HTTPS**（`localhost` 除外）。iOS 的 Service Worker 与「主屏 App 正确行为」都依赖安全上下文。

| 渠道 | 大陆手机直连 | 成本 | 结论 |
| --- | --- | --- | --- |
| Cloudflare Pages | 多数地区可用，偶有波动 | 免费，需账号 | **首选**（有账号时） |
| GitHub Pages | 可用但偏慢 | 免费，需账号；动作 = push + 开 Pages | 备选，无需额外注册 |
| 自有服务器 / 已有虚拟主机 | 取决于你 | 已有就最省事 | 有则优先 |
| 阿里云 OSS / 腾讯云 COS | 最稳 | 需域名 + 备案 | 长期正式化的选项 |
| Vercel / Netlify | 大陆基本不可达 | 免费 | 不采用 |
| cloudflared 临时隧道 | 能装，但地址每次都变 | 零成本 | 仅用于尝鲜，不用于正式安装 |

无论选哪个，部署内容都是一句话：**把 `dist/` 整个目录上传到静态托管的根目录**。以 GitHub Pages 为例：

```bash
git add -A && git commit -m "feat: PWA 离线壳"
git push origin main          # 需先配置 remote
# 仓库 Settings → Pages → Source: 选分支的 / (root) 或 /docs，这里用 GitHub Actions 或直接把 dist 推到 gh-pages 分支
```

> 注：GitHub Pages 只能发布仓库里的文件，`dist/` 已在 `.gitignore` 中，因此要么用 Actions 构建发布，要么把 `dist/` 内容推到 `gh-pages` 分支。这一步的具体做法等托管定了再写细节。

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Service Worker 缓存旧版本 | 改了代码看不到变化 | 仅生产注册；导航网络优先；缓存名带构建时间戳；`skipWaiting` + `clients.claim` |
| 部署到子路径导致白屏 | 装进主屏后一片空白 | `base: './'` + manifest 内全部相对路径；真机前先用子路径本地验证 |
| iOS 独立模式无返回/刷新 | 操作路径被打断 | 界面已有底部导航，无浏览器依赖；状态栏用 `default`，真机目检 safe-area |
| 数据绑域名，换域名/清缓存即丢 | 账本不可恢复 | 固定入口；安装前定域名；建议本期加「导出/导入 JSON」 |
| 存储被系统回收（小概率） | 同上 | 同上，导出备份是唯一对策 |
| SW 代码写错导致离线打不开 | 断网白屏 | `fetch` 失败必须回退缓存的 index；本地 build+preview 先验证离线再上真机 |
| 首次安装需联网 | 不能纯离线安装 | 属平台限制，无解；安装时需一次网络 |

## 10. 实施计划

**阶段一 · 本地做完离线壳（不部署、不碰真机）**

1. `scripts/gen-icons.py` 生成三张图标；
2. `public/manifest.json` + `index.html` meta；
3. `src/lib/sw-template.ts` + `vite.config.ts` 的 `pwa()` 插件 + `base: './'`；
4. `src/lib/sw-register.ts` + `src/main.tsx` 调用；
5. 三个测试文件 + README 三节；
6. `npm test` 全绿、`npm run build` 通过；
7. `npm run preview` → 加载一次 → DevTools Offline → 刷新 → 能记账、能看统计。

**阶段二 · 上线（等托管渠道确定）**

8. 部署 `dist/`，拿到 HTTPS 地址；
9. iPhone Safari 打开 → 分享 → 添加到主屏幕；
10. 验收：主屏图标启动无地址栏、飞行模式下记账、切流量打开、重新部署后版本更新；
11. 若本期包含导出/导入：先导出备份，再开始真实记账。

阶段一结束即可交付，**阶段一不产生任何对外暴露**（只在 127.0.0.1 上验证）。

## 11. 未决事项

1. **托管渠道**：是否有 GitHub / Cloudflare 账号、自有服务器或域名？决定阶段二怎么落地。
2. **「导出 / 导入 JSON」是否纳入本期**：不属于产品文档 MVP 五项，但 PWA 形态下数据丢失不可逆，建议纳入。
3. 是否需要「应用内显示版本号」以便确认手机上升级成功（可选，几行代码）。