# 记账器 · 技术方案（PWA 交付版）

> 状态：已评审（2026-11-07，结论见 §11）　·　基线：`fa4d5fa`　·　部署目标：GitHub Pages
> 上游文档：[产品设计](product-design.md)

## 1. 目标与范围

产品侧已定：单用户轻量记账，手机优先，MVP 只做记一笔 / 账单流 / 月度统计 / 编辑删除 / 本地持久化。本文只解决**「怎么把它变成一个 iPhone 上能长期用的东西」**，不扩展功能。

验收目标（来自 m00074 的口径）：

1. iPhone 上像 App 一样用：主屏图标、全屏无地址栏、`3 秒记一笔` 的路径不被浏览器界面打断；
2. **离开电脑也能用**：电脑关机、不连 Wi-Fi、只有流量甚至飞行模式，都能打开并记账；
3. 部署后手机首次安装需联网，之后离线可用；升级只需重新部署，无需 App Store；
4. 账本不能只有一份：能手动导出备份，换机或清缓存后能导回来（**纳入本期**，见 §6.1）；
5. 手机上能确认当前跑的是哪个版本（**纳入本期**，见 §5.7）。

明确不做：登录、云同步、多账本、预算、OCR、CSV 导出（用 JSON 备份替代，见 §6.1）、桌面打包（Electron / Tauri）。

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
| `src/lib/backup.ts` | 新增 | 纯函数：`buildBackup(records, now)` 生成备份对象，`parseBackup(text)` 解析并逐条校验 |
| `src/components/BackupPanel.tsx` | 新增 | 备份面板：导出（下载 / 复制）、导入（选文件 → 校验 → 二次确认） |
| `src/lib/build-info.ts` | 新增 | 应用版本号与构建时间，由 Vite `define` 注入，未注入时回退 `dev` |
| `.github/workflows/deploy.yml` | 新增 | 推 `main` 自动构建并发布 GitHub Pages（见 §8，阶段二） |
| `src/lib/sw-template.ts` | 新增 | 纯函数：`buildServiceWorkerSource({ cacheName, precache, indexUrl })` |
| `src/lib/sw-register.ts` | 新增 | 纯函数：`shouldRegister(env)` + `registerAppShell(deps)`，依赖可注入以便测试 |
| `vite.config.ts` | 修改 | 加 `base: './'` 与 `pwa()` 插件（`generateBundle` 里生成并 emit `sw.js`） |
| `index.html` | 修改 | 加 5 行 meta（见 5.3） |
| `src/main.tsx` | 修改 | 末尾调一次注册（生产环境才真正注册） |
| `src/components/MoreMenu.tsx` | 修改 | 增加「导出备份」「导入备份」入口；底部显示版本号 |
| `src/App.tsx` | 修改 | 备份面板开关 + 导入时替换账本（复用现有写回 effect，不新增存储路径） |
| `src/lib/sw-template.test.ts` | 新增 | 模板生成的内容校验 |
| `src/lib/sw-register.test.ts` | 新增 | 注册条件与参数校验 |
| `src/lib/pwa-assets.test.ts` | 新增 | 校验 manifest 字段与三张图标文件真实存在、尺寸正确 |
| `src/lib/backup.test.ts` | 新增 | 导出结果能被自身解析回等价账本；非法输入分类报错；有效与无效记录混合时按条跳过并计数 |
| `src/components/BackupPanel.test.tsx` | 新增 | 导出文本含当前记录；导入必须二次确认才替换；非法文件给出提示且账本不变 |
| `src/lib/build-info.test.ts` | 新增 | 版本号非空；构建时间可被 `Date` 解析 |
| `README.md` | 修改 | 补「装到 iPhone 主屏」「离线验证」「部署」三节 |

不改：`src/lib/storage.ts`（导入也走 `writeLedger`）、`src/types.ts`、`src/styles.css`（新面板复用现有 CSS 变量，不改既有布局）、现有 35 个测试用例、`package.json` 依赖（**不新增任何运行时依赖**）。

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

### 5.7 版本号显示（`src/lib/build-info.ts`）

- `vite.config.ts` 用 `define` 注入两个常量：`__APP_VERSION__`（读 `package.json` 的 `version`）与 `__BUILD_TIME__`（构建时刻，ISO 字符串）；`build-info.ts` 负责读取并提供回退值 `'dev'`，同时声明这两个全局的类型，避免 `tsc` 报未定义。
- 显示位置：`···` 菜单底部一行，形如 `v0.1.0 · 2026-11-07 16:50`。
- 它存在的唯一理由：**在手机上确认「重新部署之后到底有没有更新」**。没有它，SW 有没有换掉旧缓存只能靠猜。
- 不引入版本接口、不做更新检测弹窗、不比对远端版本——超出 MVP。

## 6. 数据与存储

现状已满足要求，本方案不修改：

- `src/lib/storage.ts` 暴露 `readLedger / writeLedger / removeLedger`，键名 `jizhangqi.v1`，读取结果三态（`missing / ok / invalid`），异常一律降级不抛错；
- 金额以「分」为整数存储，规避浮点误差。

需要写进用户文档的事实与风险：

1. 数据存在 **Safari 的 localStorage，绑定域名**；换域名、清网站数据、换手机都不迁移。
2. 加到主屏后由独立入口使用；**建议固定从主屏进入记账**，避免在 Safari 与主屏两个入口间混用产生两套数据。
3. iOS 在存储紧张时可能回收站点数据，属小概率但不可逆 → **本期已纳入「导出 / 导入 JSON」备份**（比原规划的 CSV 更简单，见 §6.1）。
4. 换托管域名等于换数据孤岛，**安装前应先把最终域名定下来**，不要用临时隧道装一次、之后再换正式域名。

升级路径（不本期做）：`storage.ts` 内部换成 IndexedDB 实现，键名与 payload 结构保持不变，一次性迁移；若日后接云同步，只在这一层加一层同步适配器，UI 与组件不动。

### 6.1 备份与恢复（JSON，本期纳入）

**格式**（信封式，带来源标记，便于日后识别与迁移）：

```json
{
  "app": "jizhangqi",
  "version": 1,
  "exportedAt": "2026-11-07T08:50:00.000Z",
  "records": [
    { "id": "...", "type": "expense", "amount": 2350, "category": "餐饮", "date": "2026-11-07", "note": "", "createdAt": 1762500000000 }
  ]
}
```

- 文件名用 **ASCII**：`jizhangqi-backup-20261107-1650.json`。中文文件名一旦在下载 / 分享链路里被转码就找不回来，不值得赌。
- `parseBackup` 同时接受裸存储 payload（`{ version: 1, records: [...] }`），因为用户可能直接从浏览器存储里抠出来一段。

**导出给两条通道（iOS 的关键）**：主屏独立模式下 `<a download>` 可能静默失败，所以不押注单一出口——

1. 「下载 .json」：`Blob` + `URL.createObjectURL` + `a[download]`，Safari 正常模式下会落到「文件」App；
2. 「复制到剪贴板」+ 一个只读 `textarea` 显示完整 JSON（长按可全选）：优先 `navigator.clipboard.writeText`，失败则退化为选中 textarea 由用户手动复制。

**导入**：`<input type="file" accept="application/json,.json">` → 读文本 → `parseBackup` → 逐条 `isRecordItem` 校验 → 面板显示「有效 N 条 / 跳过 M 条，将替换当前 K 条」→ **二次确认** → `setRecords(valid)`，落盘仍走现有的 `writeLedger` effect。

**策略**：本期只做**整账本替换**，不做按 id 合并。合并要定义冲突语义（同 id 时间戳取谁、分类重名怎么算），MVP 没有这个需求；替换的语义反而更可预测——「导入什么，就是什么」。

**不做**：自动备份、定时导出、云盘同步。备份是手动保险，不是功能。

## 7. 测试方案

| 文件 | 覆盖点 |
| --- | --- |
| `src/lib/sw-template.test.ts` | 生成的源码包含注入的缓存名/预缓存清单/index 地址；不含未替换的 `__TOKEN__`；`install`/`activate`/`fetch` 三个监听器齐全；非 GET 与跨域分支存在 |
| `src/lib/sw-register.test.ts` | 非生产环境不调用 `register`；生产环境调用一次且 URL 为 `sw.js`；`register` 抛错时返回 `false` 且不抛 |
| `src/lib/pwa-assets.test.ts` | 校验 manifest 字段与三张图标文件真实存在、尺寸正确 |
| `src/lib/backup.test.ts` | 导出 → 解析往返等价；非法 JSON、缺 `records`、版本不符各自报错；有效/无效混合按条跳过并给出计数 |
| `src/components/BackupPanel.test.tsx` | 导出文本包含当前账本；导入改账本前必须二次确认；非法文件给提示且账本不变 |
| `src/lib/build-info.test.ts` | 版本号非空；构建时间可被 `Date` 解析 |

- 六个测试全部是**纯函数 / 文件系统校验**，不模拟 Service Worker 运行时（jsdom 里没有 SW，硬造只会得到假绿）。
- 现有 35 个用例不改；`npm test` 全量通过 + `npm run build` 成功 + `tsc --noEmit` 无错，作为交付前置条件。
- 人工验收部分（自动化测不到）：`npm run build && npm run preview` → 打开一次 → DevTools 切 Offline → 刷新仍能记账；真机装主屏后飞行模式复测。

## 8. 部署方案

技术上的硬约束只有一条：**必须是 HTTPS**（`localhost` 除外）。iOS 的 Service Worker 与「主屏 App 正确行为」都依赖安全上下文。

| 渠道 | 结论 |
| --- | --- |
| **GitHub Pages** | **采用**（评审结论）：已有账号、免费、自带 HTTPS、push 即发布；大陆多数网络可直连，个别地区偶有波动，但装进主屏后的离线使用不受影响 |
| 自有服务器 / 虚拟主机 | 无 |
| Cloudflare Pages | 备选：要另外开账号，本期不动 |
| Vercel / Netlify | 大陆基本不可达，排除 |
| 阿里云 OSS / 腾讯云 COS | 最稳但要域名 + 备案，留到「确定长期用」再考虑 |
| cloudflared 临时隧道 | 地址每次变、电脑一关就断，只适合尝鲜 |

**发布方式：GitHub Actions，推 `main` 即构建发布**（不提交 `dist/`：它已在 `.gitignore` 里，仓库只存源码）。

```yaml
# .github/workflows/deploy.yml 要点（非完整文件）
on: { push: { branches: [main] }, workflow_dispatch: {} }
permissions: { contents: read, pages: write, id-token: write }
jobs:
  build:
    steps: checkout → setup-node(24, cache: npm) → npm ci → npm run build → upload-pages-artifact(dist)
  deploy:
    needs: build
    environment: github-pages
    steps: deploy-pages
```

- 仓库 Settings → Pages → Source 选 **GitHub Actions**，一次性配置。
- 免费账号的 Pages 要求仓库 **public**（或账号是 Pro）。代码公开不影响隐私——账本只存在手机 localStorage 里，仓库中一条真实数据都没有。
- 地址形如 `https://<用户名>.github.io/<仓库名>/`，**子路径形态**，正是 `base: './'` 要覆盖的场景（见 §5.6）。
- 首次需配 remote：`git remote add origin https://github.com/<用户名>/<仓库名>.git`；本机直连 GitHub 的 TLS 会被掐，push 走系统代理 `git config http.proxy http://127.0.0.1:10800`，凭据用 PAT。
- Pages 对 HTML 约有 10 分钟缓存；重新部署后手机上最多延迟这个量级才拿到新版，SW 缓存名随之变化不会卡死（版本号可确认，见 §5.7）。

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| Service Worker 缓存旧版本 | 改了代码看不到变化 | 仅生产注册；导航网络优先；缓存名带构建时间戳；`skipWaiting` + `clients.claim` |
| 部署到子路径导致白屏 | 装进主屏后一片空白 | `base: './'` + manifest 内全部相对路径；真机前先用子路径本地验证 |
| iOS 独立模式无返回/刷新 | 操作路径被打断 | 界面已有底部导航，无浏览器依赖；状态栏用 `default`，真机目检 safe-area |
| 数据绑域名，换域名/清缓存即丢 | 账本不可恢复 | 固定入口；安装前定域名；本期已含「导出 / 导入 JSON」（§6.1），建议记一段时间就导出一次 |
| 存储被系统回收（小概率） | 同上 | 同上，手动导出是唯一对策 |
| SW 代码写错导致离线打不开 | 断网白屏 | `fetch` 失败必须回退缓存的 index；本地 build+preview 先验证离线再上真机 |
| 首次安装需联网 | 不能纯离线安装 | 属平台限制，无解；安装时需一次网络 |

## 10. 实施计划

**阶段一 · 本地做完（不部署、不碰真机）**

1. `scripts/gen-icons.py` 生成三张图标；
2. `public/manifest.json` + `index.html` meta；
3. `src/lib/sw-template.ts` + `vite.config.ts` 的 `pwa()` 插件 + `base: './'`；
4. `src/lib/sw-register.ts` + `src/main.tsx` 调用；
5. `src/lib/backup.ts` + `BackupPanel` + `MoreMenu` / `App` 接入口；
6. `src/lib/build-info.ts` + 菜单底部版本号；
7. 三个 PWA 测试 + 三个备份 / 版本测试；
8. `npm test` 全绿、`npm run build` 通过；
9. `npm run preview` → 加载一次 → DevTools Offline → 刷新 → 能记账、能看统计；
10. 备份闭环演练：导出 → 清空账本 → 导入刚导出的文件 → 数据一致；
11. 写 README 三节（装到主屏 / 离线验证 / 备份恢复）。

**阶段二 · 上线（GitHub Pages）**

12. 建仓库（public）+ `git remote add` + 配代理；
13. 加 `.github/workflows/deploy.yml`，Settings → Pages 选 GitHub Actions；
14. 首次 push，等 Actions 绿，拿到 `https://<用户名>.github.io/<仓库名>/`；
15. iPhone Safari 打开 → 分享 → 添加到主屏幕；
16. 真机验收：主屏启动无地址栏、飞行模式记账、切流量打开、改一次版本号重新部署看菜单底部是否更新；
17. **先导出一次备份，再开始记真实账。**

阶段一结束即可交付，**阶段一不产生任何对外暴露**（只在 127.0.0.1 上验证）。

## 11. 评审结论（2026-11-07）

| 事项 | 决定 |
| --- | --- |
| 托管渠道 | **GitHub Pages**：有账号，无自有服务器 |
| 导出 / 导入 JSON | **纳入本期**，格式与策略见 §6.1（整账本替换） |
| 应用内版本号 | **纳入本期**，`···` 菜单底部一行（见 §5.7） |

剩余未定，都不阻塞阶段一：

1. 仓库名与归属（阶段二开始时定，public 即可）；
2. 是否改用 iOS 沉浸式状态栏（`black-translucent`）——需真机目检 safe-area 后再决定；
3. 备份是否再加一个「分享到文件 App / 微信」入口（Web Share API，非必需）。