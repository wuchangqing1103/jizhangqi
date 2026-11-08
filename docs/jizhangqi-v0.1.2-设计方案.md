# 记账器 v0.1.2 设计方案

> 这份文档是「施工图」，给下一个会话直接照着做。它只描述**要改成什么样、怎么改、怎么验**，不重复产品设计文档（`docs/product-design.md`）里的定位与取舍。
>
> 现状版本：v0.1.1（commit `6c32cc5`，线上 https://wuchangqing1103.github.io/jizhangqi/）
> 目标版本：v0.1.2
> 分 4 批交付，一批一次 commit、一次上线、一次验收。

---

## 1. 现状（施工前必须知道的）

### 1.1 技术栈

| 项 | 值 |
| --- | --- |
| 框架 | React 19.3.1 + TypeScript 7.0.2（strict + noUnusedLocals/Parameters） |
| 构建 | Vite 8.3.6，`base: './'`（兼容 GitHub Pages 子路径） |
| 测试 | Vitest 5.1.0 + jsdom + @testing-library/react，11 个文件 69 个用例 |
| 样式 | 单文件 `src/styles.css`（1562 行），CSS 变量 + 原生媒体查询，无 UI 库 |
| 图标 | `lucide-react` |
| 存储 | localStorage，key `jizhangqi.v1`，payload `{ version: 1, records }` |
| PWA | 手写 Service Worker（`src/lib/sw-template.ts` + `vite.config.ts` 内联插件），缓存优先 |
| 部署 | GitHub Actions → GitHub Pages（`.github/workflows/deploy.yml`） |

**硬约束**：不新增任何运行时依赖；不改动 `src/styles.css` 既有视觉语言（暖白 `#f3f1ec` + 墨色 `#1e1c18` + 橙色强调 `#c96a3a`）。

### 1.2 关键文件

| 文件 | 职责 | 本版是否改 |
| --- | --- | --- |
| `src/App.tsx` | 全部状态（records/tab/month/sheet/confirm/menu/backup/toast） | 改（大） |
| `src/types.ts` | `RecordItem`、`RecordDraft`、`DayGroup`、`Tab` | 改 |
| `src/lib/storage.ts` | 读写 localStorage、`isRecordItem` | 改（v2 迁移） |
| `src/lib/stats.ts` | `monthRecords` / `summarize` / `groupByDay` / `categoryBreakdown` | 小改 |
| `src/lib/date.ts` | `todayStr` / `monthOf` / `addMonths` / `monthLabel` 等 | 不改 |
| `src/lib/format.ts` | `formatCents` / `splitCents` / `parseAmountInput` | 不改 |
| `src/lib/seed.ts` | 示例数据 `createSeedRecords` / `initialRecords` / `resetToSeed` | 改（补 accountId） |
| `src/lib/backup.ts` | 备份信封 `buildBackup` / `parseBackup` | 改（v2） |
| `src/components/EntrySheet.tsx` | 记账浮层（249 行） | 改（大） |
| `src/components/BillPage.tsx` | 账单页 + 行渲染（160 行） | 改（大） |
| `src/components/StatsPage.tsx` | 统计页（126 行） | 改（中） |
| `src/components/BackupPanel.tsx` | 备份面板（181 行） | 小改 |
| `src/components/ConfirmDialog.tsx` | 二次确认框，`role="alertdialog"` | 复用，不改 |
| `src/components/MoreMenu.tsx` | 右上角菜单（两项 + 版本号） | 不改 |
| `src/components/BottomNav.tsx` | 底部导航 + 中央＋号 | 不改 |

### 1.3 现有数据模型

```ts
// src/types.ts
export interface RecordItem {
  id: string
  type: 'expense' | 'income'
  amount: number      // 单位：分，正整数
  category: string    // 'food' | 'transport' | ... | 'income-other'
  date: string        // 'YYYY-MM-DD'
  note: string
  createdAt: number
}
```

### 1.4 命令

```powershell
npm test                                   # vitest run（必须全绿）
npx tsc --noEmit                           # 类型检查
npm run build                              # tsc + vite build
npm run preview                            # 本地预览 dist
```

> 本机 GS 环境注意：`edit`/`write` 覆盖已存在文件偶发 `ReplaceFileW EIO (Win32 32)`，改用 pwsh：
> `[System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))`。
> pwsh 控制台打印中文乱码只是 GBK 解码问题，文件本身正常。

---

## 2. 本版目标

| 批次 | 主题 | 一句话 |
| --- | --- | --- |
| 1 | 手感修复 | 弹出动画减速更明显、保存键不再被顶走、提示位置统一、左滑/长按删除、删两行冗余小字 |
| 2 | 多账目 | 账本维度进数据模型（v2 + 迁移），顶部可切换，记账可归属，全链路带账本 |
| 3 | 输入与查找 | 金额算式（`15+8.5`）、账单搜索（跨月） |
| 4 | 洞察与导出 | 月度对比（比上月 + 近 6 月趋势）、CSV 导出 |

**明确不做**：登录/云同步、自动备份、预算提醒、OCR、多币种、自定义分类。备份格式会预留版本号，等登录版接入。

---

## 3. 批次 1：手感修复（预计 3–4 小时）

### 3.1 弹出动画：把减速点提前

**现状**（`src/styles.css:779-797`、`1261-1276`）：`sheet-up 0.75s cubic-bezier(0.16,1,0.3,1)`，0% 位移 104% → 33% 到 −1.4% → 60% 到 0.4% → 100% 归位。问题：0.75 秒里前 1/3 就走完，观感是「冲上去再弹回来」，不是「到位后舒缓贴合」。

**目标**：面板顶边约 0.24 秒（30%）就基本到位，随后 0.56 秒只走最后 4%，减速感明显。

**做法**：动画时长 0.8s，逐关键帧指定缓动函数（CSS 允许在 keyframe 内写 `animation-timing-function`）：

```css
.entry-sheet {
  /* 0.8 秒：前 30% 走完 96% 行程，之后长时间缓慢贴合 */
  animation: sheet-up 0.8s both;
  will-change: transform;
}

@keyframes sheet-up {
  0% {
    opacity: 0.7;
    transform: translate(-50%, 104%);
    animation-timing-function: cubic-bezier(0.18, 0.86, 0.24, 1);
  }
  30% {
    opacity: 1;
    transform: translate(-50%, -0.6%);
    animation-timing-function: cubic-bezier(0.33, 0, 0.25, 1);
  }
  62% {
    transform: translate(-50%, 0.18%);
  }
  100% {
    transform: translate(-50%, 0);
  }
}
```

遮罩淡入保持 0.35s（`fade-in`）。`prefers-reduced-motion` 的既有全局规则会自动压制，无需新增。

**效果**：点＋，面板在 0.24 秒内升起就位，最后半秒是几乎察觉不到位移的「贴合」，不顿、不硬。

**验收**：iPhone 冷启，点＋，看面板顶边到达最终位置后仍有明显减速滑行；连续开关 10 次不抖。

---

### 3.2 记账面板：分类 5 列两行 + 底部固定

**现状**（`EntrySheet.tsx:190-206`、`styles.css:950-1079`）：
- `.category-grid` 3 列，9 个支出分类排 3 行，约占 220px；
- `.entry-sheet` 整块 `overflow-y: auto`（`styles.css:788`），内容一长，**键盘和保存键跟着内容滚下去**，必须下滑才能点保存。

**目标**：
1. 分类压到 **5 列两行**（支出 5+4，收入 5 个一行），全部露出，不设「更多」；
2. 面板改成 **header / 可滚动 body / 固定 footer** 三段式，键盘和保存键永远钉在底部。

**做法 A（结构调整）**：

```css
.entry-sheet {
  display: flex;
  flex-direction: column;
  max-height: 92dvh;
  overflow: hidden;          /* 整块不再滚动 */
}
.sheet-body {
  flex: 1 1 auto;
  min-height: 0;             /* 关键：允许 flex 子项收缩并内部滚动 */
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sheet-footer {
  flex: 0 0 auto;
  margin-top: 0;
  padding-top: 10px;
  border-top: 1px solid var(--line);
  background: #fbf9f4;       /* 与面板同色，滚动内容不会透出来 */
}
```

**做法 B（分类网格）**：

```css
.category-grid {
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
}
.category-option {
  gap: 4px;
  padding: 7px 2px 6px;
  border-radius: 12px;
  font-size: 10.5px;
}
.category-option .cat-icon {
  width: 26px;
  height: 26px;
  border-radius: 8px;
}
```

`EntrySheet.tsx` 里 `<CategoryIcon id={option.id} size={17} />` 改 `size={16}`；键盘 `.key` 高度 42→40，`.save-button` 46→44，减少 12px。

**做法 C（键盘弹起别遮输入）**：备注框 `onFocus` 时 `event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })`，让 `.sheet-body` 自己滚动，而不是把整个页面顶起来。

**尺寸核算**（iPhone 15 Pro，844pt）：header ~60 + 支出/收入 40 + 日期 34 + 金额 60 + 分类 145 + 备注 44 + 键盘 178 + 保存 54 ≈ 615，92dvh ≈ 776 → **一屏放下，不需要滚动**；小屏（SE 667pt）只有中间区滚，保存键始终可见。

**验收**：打开面板不滚动就能点「保存」；选分类时九宫格不用滑动；备注聚焦时页面不整体上移。

---

### 3.3 提示（Toast）统一位置

**现状**（`styles.css:1216-1233`）：`.toast { position: absolute; bottom: calc(94px + safe); }`，相对 `.app-frame`；而 `.app-frame` 在手机上 `min-height: 100dvh` 且随内容变高，所以列表一长，toast 就被推到整页最底部，必须滑下去才看得到；和＋号重叠也是这个原因。

**做法**：

```css
.toast {
  position: fixed;                                  /* 改这里 */
  bottom: calc(104px + env(safe-area-inset-bottom)); /* 改这里：＋号上方约 40px */
  z-index: 45;
  /* 其余保持不变 */
}
```

桌面媒体查询里的 `.toast { bottom: 92px; }` 改成 `bottom: 100px;`（或直接删掉该条，由基础规则统一）。

**效果**：「已记一笔 / 已更新记录 / 已删除记录 / 账本已清空 / 已导入 N 条」全部出现在**同一个位置**——＋号正上方，不遮＋号、不遮底部导航、不管列表多长都看得见。

**验收**：记录很多时记账，toast 立刻可见；删除时同一位置；不挡＋号点击。

---

### 3.4 左滑 + 长按删除

**现状**（`BillPage.tsx:111-139`）：整行是 `<button className="record-row" onClick={onEdit}>`；删除只能「点开 → 右上角删除 → 确认」，三步。长按会触发 iOS 的文本选择菜单（截图里的「拷贝/查询/翻译」）。

**目标**：左滑露出红色「删除」，点击后弹确认框（用户明确选择：**要二次确认**，不做直接删除 + 撤销）；长按 500ms 同样弹确认框；关掉系统长按菜单；不影响上下滚动。

**DOM 结构**（`RecordRow` 重写）：

```tsx
<li className="record-item">
  <div className="record-swipe" style={{ transform: `translateX(${offset}px)` }}>
    <button type="button" className="record-row" /* 原有内容 */ />
    <button
      type="button"
      className="record-delete"
      aria-label={`删除 ${name}${record.note ? ` ${record.note}` : ''}`}
      onClick={() => onRequestDelete(record)}
    >
      删除
    </button>
  </div>
</li>
```

```css
.record-item { position: relative; overflow: hidden; }
.record-swipe { position: relative; display: flex; transition: transform 0.18s ease; }
.record-row {
  touch-action: pan-y;        /* 横向手势归我们，纵向仍可滚 */
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none; /* 关掉 iOS 长按菜单 */
}
.record-delete {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 84px;
  border-radius: 0 14px 14px 0;
  background: var(--danger);
  color: #fff;
  font-size: 12.5px;
}
```

**手势逻辑**（建议抽成 `useSwipeRow` 或直接写在 `RecordRow` 内，状态放在 `DaySection` 或 `BillPage` 的 `openId`，保证同时只开一行）：

| 参数 | 值 |
| --- | --- |
| `MAX_OFFSET` | 84（px） |
| `OPEN_THRESHOLD` | 40 |
| `LONG_PRESS_MS` | 500 |
| `CANCEL_MOVE` | 8（px，判定为纵向滚动或误触） |

- `pointerdown`：记录 `x/y/time`，`setPointerCapture`，启动 500ms 长按计时器；
- `pointermove`：若 `|dy| > |dx|` 且已超 8px → 取消手势与长按（交给页面滚动）；若横向 → `offset = clamp(dx, -84, 0)`（只允许左滑）；
- 长按计时器到点：弹确认框，标记 `longPressFired = true`，之后 `pointerup` 不再打开编辑；
- `pointerup`：`offset < -40` → 吸附到 −84 并记录 `openId`；否则归 0；移动 < 8px 且 < 500ms → 视为点击，走 `onEdit`；
- 点击行时若 `openId === record.id` → 只关闭不打开编辑；
- `.app-main` 的 `scroll` 事件里 `setOpenId(null)`，滚动即收起；
- `onContextMenu={(e) => e.preventDefault()}` 兜底桌面右键菜单。

**无障碍**：删除按钮始终在 DOM 里（可用 Tab 到达、`aria-label` 带分类和备注），不依赖手势可用。

**确认文案**（复用 `ConfirmDialog`）：
- 标题「删除这笔记录？」
- 正文「删除后无法恢复，这笔记录会从账本中移除。」
- 确认按钮「删除」

**测试要点**（jsdom + `fireEvent.pointerDown/Move/Up`，需要给事件补 `clientX/clientY`；jsdom 没有 `PointerEvent` 时用 `fireEvent` 的通用事件并断言行为而不是事件类型）：
1. 左滑超过 40px 再抬手 → 删除按钮可点（`getByRole('button', { name: '删除 餐饮 午饭' })`）；
2. 点删除按钮 → 出现 `alertdialog`；点「删除」→ 记录消失 + toast「已删除记录」；点「取消」→ 记录还在；
3. 长按 500ms（`vi.useFakeTimers` 推进）→ 出现 `alertdialog`，且不打开编辑面板；
4. 纵向拖动（dy 大）不打开删除，也不触发编辑。

---

### 3.5 删掉两行冗余小字（用户指定）

1. `BillPage.tsx:64` 的 `<span>点条目可编辑</span>`：整行右半边删掉（标题 `.list-heading` 保留，右侧留空给批次 3 的搜索入口）。
2. `BillPage.tsx:95-98` 的 `.day-totals`（当天「支出 ¥x / 收入 ¥x」）：整块删除，**包含收入**。日期行只留「今天 / 11月7日 / 周六」。

删除后 `DaySection` 不再需要 `group.expense/income` 的渲染，`DayGroup` 类型保持不变（其他逻辑可能仍在用），只删 UI。

**效果**：账单页头部少两行灰字，信息层级更干净；每日小计与顶部「本月支出」不再重复。

**验收**：账单页看不到「点条目可编辑」；日期行右侧没有支出/收入；统计页数据不受影响。

---

### 3.6 批次 1 测试清单

| 用例 | 断言 |
| --- | --- |
| 面板不滚动即可保存 | 打开面板后 `保存` 在 `getBoundingClientRect` 可见范围内（jsdom 无布局，改为断言 `.sheet-footer` 是 `.entry-sheet` 的直接子元素且 `保存` 在其中） |
| 分类 5 列 | 断言 `style` 无关，改为断言 9 个分类按钮全部渲染且无「更多」按钮 |
| Toast 固定 | `screen.getByText('已记一笔').className` 含 `toast`，并新增 CSS 规则断言（读 `styles.css` 文本含 `position: fixed` 的 `.toast` 块） |
| 左滑删除 | 见 3.4 的 1–4 |
| 日期行无小计 | `queryByText(/^支出 ¥/)` 为 null；`queryByText('点条目可编辑')` 为 null |

预计批次 1 结束后：**13 个文件 / 约 76 个用例**。

---

## 4. 批次 2：多账目（预计 4–6 小时）

### 4.1 设计结论（用户确认的口径）

A（资金源）和 B（独立账本）**合成一个扁平模型**，不做两级结构：

- 顶部一排：`[全部] [现金] [微信] [支付宝] [生活] [工作] [+管理]`
- 选「全部」→ 合并账（A 的用法）；选某一个 → 只看它（B 的用法）
- 每笔记录**必须**归属一个账本（`accountId`）
- 记账面板顶部显示「记到：微信」，可现场切换，默认沿用上次使用的账本（在「全部」视图下，沿用最近一次真实使用的账本，而不是 `all`）

### 4.2 数据模型（v2）

```ts
// src/types.ts
export interface Account {
  id: string
  name: string          // 1–8 字
  color: string         // '#8c8a83' 这类十六进制
  createdAt: number
}

export interface RecordItem {
  id: string
  type: RecordType
  amount: number
  category: string
  date: string
  note: string
  createdAt: number
  accountId: string     // 新增，必填
}

export type AccountFilter = 'all' | string

export interface LedgerState {
  accounts: Account[]
  activeAccountId: AccountFilter
  records: RecordItem[]
}
```

### 4.3 存储与迁移（`src/lib/storage.ts` 重写）

```ts
export const STORAGE_KEY = 'jizhangqi.v1'      // key 不改，避免双份真源
export const DEFAULT_ACCOUNT_ID = 'acc-default'
export const DEFAULT_ACCOUNT: Account = {
  id: DEFAULT_ACCOUNT_ID,
  name: '默认',
  color: '#8c8a83',
  createdAt: 0,
}

export type LedgerRead =
  | { status: 'missing' }
  | { status: 'ok'; ledger: LedgerState }
  | { status: 'invalid' }

export function migrateV1(records: RecordItem[]): LedgerState
export function readLedger(storage?: Storage | null): LedgerRead
export function writeLedger(ledger: LedgerState, storage?: Storage | null): boolean
```

**读取规则**（顺序执行，任一步失败 → `invalid`，绝不抛错、绝不丢数据）：

1. `JSON.parse` 失败 → `invalid`
2. `version === 1` 且 `records` 全部通过 `isRecordItem`（**不含** `accountId` 的要求）→ 迁移：
   `accounts: [DEFAULT_ACCOUNT]`，`activeAccountId: DEFAULT_ACCOUNT_ID`，每条记录补 `accountId: DEFAULT_ACCOUNT_ID`
3. `version === 2`：
   - `accounts` 必须是非空数组，逐项 `isAccount`（id 非空、name 非空、color 合法、createdAt 有限）
   - `records` 逐项 `isRecordItem`（新增 `accountId` 非空字符串）
   - 记录里出现未知 `accountId` → 落到第一个账本（自愈，不丢）
   - `activeAccountId` 不是 `'all'` 且不在 accounts 里 → 回退到第一个账本
4. 其他版本号 → `invalid`

**写入**：始终写 `{ version: 2, accounts, activeAccountId, records }`。

**单元测试**（`src/lib/storage.test.ts` 扩充）：v1 迁移保留条数与内容、v2 往返、未知 accountId 自愈、activeAccountId 失效回退、损坏 JSON 退化 invalid、`writeLedger` 异常返回 false。

### 4.4 账本 API（新增 `src/lib/accounts.ts`）

```ts
export function createAccount(name: string, existing: Account[], now?: number):
  | { ok: true; account: Account }
  | { ok: false; error: 'empty' | 'too-long' | 'duplicate' }

export function renameAccount(accounts: Account[], id: string, name: string): Account[]
export function removeAccountPlan(accounts: Account[], records: RecordItem[], id: string)
  : { target: Account | null; affected: number }   // 删前算：会牵连多少条记录
export function moveRecords(records: RecordItem[], from: string, to: string): RecordItem[]
```

规则：名称 trim、1–8 字、同账本内不允许重名（`duplicate`）；删除时必须先转移到另一个账本（转移目标默认第一个非自身账本），转移后记录数不变——**任何情况下不删记录**。

### 4.5 状态与数据流（`src/App.tsx`）

现在是 `records` + 多个布尔状态；改成单一 `ledger` 状态，避免「记录和账本分家」导致的不一致：

```tsx
const [ledger, setLedger] = useState<LedgerState>(() => initialLedger())
useEffect(() => { writeLedger(ledger) }, [ledger])

const visibleRecords = useMemo(
  () => filterByAccount(ledger.records, ledger.activeAccountId),
  [ledger.records, ledger.activeAccountId],
)
```

- `BillPage` / `StatsPage` / 搜索 / CSV 都吃 `visibleRecords`（备份导出吃全量 + `accounts`）。
- 新增记录：`accountId = ledger.activeAccountId === 'all' ? lastUsedAccountId : ledger.activeAccountId`；`lastUsedAccountId` 从 `activeAccountId` 与记录倒序推导，保证「全部」视图下也有合理默认。
- 删账本：`confirmRecord` 同款确认框，文案写明「N 条记录会转到『XX』」。

### 4.6 UI

**4.6.1 账本切换条**（新增 `src/components/AccountBar.tsx`）

位置：`MonthSwitcher` 下面、`<main>` 上面（`App.tsx:139` 之后）。

```tsx
<nav className="account-bar" aria-label="账本">
  <button type="button" className={active === 'all' ? 'account-chip active' : ''}>全部</button>
  {ledger.accounts.map((account) => (
    <button
      key={account.id}
      type="button"
      className={active === account.id ? 'account-chip active' : ''}
      aria-pressed={active === account.id}
      style={{ '--acc': account.color } as CSSProperties}
    >
      {account.name}
    </button>
  ))}
  <button type="button" className="account-manage" aria-label="管理账本">＋</button>
</nav>
```

```css
.account-bar {
  display: flex;
  gap: 7px;
  padding: 0 20px 10px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scrollbar-width: none;
}
.account-bar::-webkit-scrollbar { display: none; }
.account-chip {
  flex: 0 0 auto;
  padding: 5px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid var(--line);
  color: var(--ink-3);
  font-size: 12px;
}
.account-chip.active { background: var(--ink); border-color: var(--ink); color: #f7f4ee; }
.account-manage { /* 虚线圆角小方块，居中显示 ＋ */ }
```

**4.6.2 记账面板归属**（`EntrySheet` 顶部，收支切换上方或下方一行）

用一个原生 `<select>` 最稳（iOS 原生选择器、无障碍免费）：

```tsx
<label className="account-pick">
  记到
  <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
    {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
  </select>
</label>
```

`RecordDraft` 增加 `accountId`；保存时带上。

**4.6.3 管理面板**（新增 `src/components/AccountPanel.tsx`，`role="dialog"`，与 `BackupPanel` 同款卡片样式）

- 列表：色点 + 名称 + 「改名」+「删除」
- 底部：输入框 + 「新增」按钮（回车也可）
- 删除：若该账本有记录 → 弹「N 条记录会转到『XX』，仍要删除？」；无记录直接删
- 关闭按钮、Esc 关闭

### 4.7 连带改造清单

| 位置 | 改法 |
| --- | --- |
| `src/lib/seed.ts` | 示例记录补 `accountId: DEFAULT_ACCOUNT_ID`；首次初始化账本时带上 `accounts: [DEFAULT_ACCOUNT]` |
| `src/lib/backup.ts` | 信封 v2：`{ app, version: 2, exportedAt, accounts, records }`；`parseBackup` 同时接受 v1（自动迁移）与 v2，返回 `{ accounts, records }` |
| `BackupPanel.tsx` | 导出显示 v2；导入提示增加账本数（「包含 N 个账本」） |
| `StatsPage` | props 不变（吃已过滤 records），空态文案可提当前账本名 |
| 账单页空态 | 「这个月还没有记录」→ 可加一行当前账本名 |
| `README.md` | 新增「多账本」小节 |

### 4.8 批次 2 测试清单

- `accounts.test.ts`：新增（空名/超长/重名/正常）、改名、删除转移数量守恒
- `storage.test.ts`：v1→v2 迁移、v2 往返、坏数据、未知 accountId 自愈
- `backup.test.ts`：v2 往返、导入 v1 文件迁移成功
- `App.test.tsx`：切换账本只显示该账本记录；「全部」显示合并；新增记录归属当前账本；删除账本二次确认并转移
- `AccountBar` 交互：点 chip 切换、＋ 打开管理面板

预计批次 2 结束后：**17 个文件 / 约 95 个用例**。

---

## 5. 批次 3：金额算式 + 搜索（预计 3–4 小时）

### 5.1 金额算式

**新增 `src/lib/expression.ts`**：

```ts
export type ExpressionResult =
  | { ok: true; cents: number }
  | { ok: false; reason: 'empty' | 'syntax' | 'divide-by-zero' }

export function evaluateAmountExpression(text: string): ExpressionResult
```

规则（必须写进测试）：

| 输入 | 结果 |
| --- | --- |
| `''` | `empty` |
| `15` | 1500 分 |
| `15+8.5` | 2350 分 |
| `100-20*2` | 6000 分（先乘除后加减） |
| `128*0.8` | 10240 分 |
| `10/0` | `divide-by-zero` |
| `5+` / `+5` / `1++2` | `syntax` |
| `1.234` | `syntax`（每段最多两位小数） |
| `123456789` | `syntax`（整数最多 8 位） |

实现：正则分词 `/(\d+(?:\.\d{1,2})?)|([+\-*/×÷])/g`，要求匹配覆盖全串；先乘除（栈）后加减；结果 `Math.round(yuan * 100)`，避免浮点误差；不使用 `eval`/`Function`。

**EntrySheet 改造**：

- `amountText` 允许出现运算符；`nextAmount` 扩展为 `appendAmountToken(current, key)`：运算符在空串/末尾是运算符时忽略（或替换末尾），遇到 `.` 时只在当前数字段内判重；
- 键盘下方新增一行运算符键（`.keypad-ops`，4 个键，高 34，`+ − × ÷`），显示符号映射到 `+ - * /`；
- 金额右侧显示灰色预览「= ¥23.50」（仅当含运算符且结果合法）；
- `canSave` 改用 `evaluateAmountExpression(amountText)` 的结果；非法时保存置灰，并在预览处显示原因（「除数为 0」「算式不完整」）；
- 保存时 `onSubmit({ ..., amount: result.cents })`。

**测试**：`expression.test.ts` 覆盖上表 10 条；`EntrySheet` 交互：点 `1` `5` `+` `8` `.` `5` → 预览 `= ¥23.50` → 保存后账单出现 ¥23.50。

### 5.2 搜索

**新增 `src/lib/search.ts`**：

```ts
export function searchRecords(records: RecordItem[], query: string): RecordItem[]
```

匹配规则（大小写不敏感、空格 trim）：

1. 备注包含（`note.toLowerCase().includes(q)`）
2. 分类名包含（`findCategory(category)?.name`）
3. 金额文本包含：`formatCents(amount)` 与 `(amount / 100).toFixed(2)` 都试，输入 `128` 能命中 `128.00` 与 `128.50`
4. 日期前缀：`2026-11`、`2026-11-07`
5. 账本名包含（可选，批次 2 之后有 `accounts` 时）

空查询返回 `[]`（不显示全部）。

**BillPage 改造**：

- `.list-heading` 右侧由「点条目可编辑」改为放大镜按钮（`aria-label="搜索账单"`）；
- 点击后标题行变成 `<input type="search" aria-label="搜索账单" placeholder="搜备注、分类、金额" />` + 「取消」；
- 300ms 防抖（`useEffect` + `setTimeout`）；
- 搜索时**跨月**：`records` 用全量（App 传入的 `visibleRecords`），不按 `month` 过滤；标题下方显示「找到 N 笔 · 支出 ¥X」；
- 结果仍按天分组渲染，点行可编辑；搜索条件变化时滚动复位；
- 关闭搜索回到当月视图。

**测试**：`search.test.ts`（备注/分类/金额/日期前缀/空查询）；`App.test.tsx` 增加：输入 `午饭` 能找到跨月记录；清空后回到当月。

预计批次 3 结束后：**19 个文件 / 约 110 个用例**。

---

## 6. 批次 4：月度对比 + CSV（预计 3 小时）

### 6.1 月度对比

**`src/lib/stats.ts` 新增**：

```ts
export interface MonthComparison {
  current: number
  previous: number
  delta: number
  percent: number | null   // previous 为 0 时为 null
}
export function compareMonthExpense(records: RecordItem[], month: string): MonthComparison
export function recentMonths(month: string, count: number): string[]  // 从旧到新
```

**StatsPage 新增卡片**（放在 type-switch 下方、stats-hero 上方）：

- 主文案：`比上月多花 ¥213.40` / `比上月少花 ¥58.00` / `上月没有支出`
- 副文案：`（+18%）`，颜色：多花用 `--accent`，少花用 `--green`
- 迷你柱状图：近 6 个月，当月高亮，柱高按最大值归一化；点柱子切到那个月（`onChangeMonth` 需要新增 prop，从 App 传 `setMonth`）

### 6.2 CSV 导出

**新增 `src/lib/csv.ts`**：

```ts
export const CSV_HEADER = ['日期', '类型', '分类', '金额(元)', '备注', '账本']
export function buildCsv(records: RecordItem[], accounts: Account[]): string  // 带 \ufeff BOM + CRLF
export function csvFileName(now?: Date): string                               // jizhangqi-20261108.csv
```

- 金额输出元（`(cents / 100).toFixed(2)`）
- 字段含 `,` `"` 换行时用双引号包裹、内部 `"` 变 `""`
- 类型输出「支出/收入」，账本由 `accountId` 查名（查不到输出「默认」）
- 导出范围：当前账本筛选 + **全部月份**（排序：日期升序，同日按 createdAt 升序）

**BackupPanel 新增**「导出 CSV」按钮（在下载 JSON 旁边），`Blob` + `text/csv;charset=utf-8`。

**测试**：`csv.test.ts`（BOM、表头、含逗号与引号的备注、金额格式、账本名映射）；`BackupPanel.test.tsx` 断言按钮存在且点击触发下载（mock `URL.createObjectURL`）。

预计全部完成后：**21 个文件 / 约 118 个用例**。

---

## 7. 每批的交付定义（Definition of Done）

1. `npx tsc --noEmit` 无错误
2. `npm test` 全绿（用例数不低于本文预期）
3. `npm run build` 成功
4. `package.json` version 升一位（0.1.2 内不再变），`README.md` 同步
5. commit（Conventional Commits，中文正文），push 到 `main`
6. GitHub Actions 成功，线上页面可访问
7. 用户手机冷启动验收通过

**提交信息建议**

```
feat: 记账面板布局与手势删除优化（v0.1.2 批次 1）
feat: 支持多账本与 v1→v2 数据迁移（v0.1.2 批次 2）
feat: 金额算式输入与账单搜索（v0.1.2 批次 3）
feat: 月度对比与 CSV 导出（v0.1.2 批次 4）
```

---

## 8. 风险与回滚

| 风险 | 应对 |
| --- | --- |
| v2 迁移写坏旧数据 | 迁移在读取时**纯函数**完成，只有写入才落盘；上线前用真实备份 JSON 跑一遍单测；出问题可 `git revert` 回到 v0.1.1，旧数据仍是 v1 格式未被改（写入前会先 migrate 再写，一旦写过就是 v2——**因此迁移测试必须覆盖全部现有记录形状**） |
| 左滑手势与页面滚动打架 | `touch-action: pan-y` + 纵向优先判定；真机验收必须上下快速滑动列表 |
| 5 列分类在小屏挤 | 文字 10.5px，两字分类名（餐饮/交通…）刚好；若挤，回退 4 列两行 + 「更多」 |
| 搜索跨月与月份条语义冲突 | 搜索态在标题下方显示「搜索全部时间」，并禁用月份切换的视觉强调 |
| CSV 在 Excel 乱码 | 必须带 UTF-8 BOM，测试断言首字符 `\ufeff` |
| 缓存优先导致用户看不到新版 | 每次构建 CACHE 名带时间戳；验收要求冷启两次 |

---

## 9. 工作方式（给下一个会话）

### 9.1 与用户的约定

- **每次开工前必须先报备要做什么，等用户回「开始」再动手**。用户明确要求掌控节奏（原话：「每次执行任务时都要经过我允许再行动」）。
- 交付时用中文、结论先行，说清「改了什么 / 现在是什么效果 / 你去哪里验」。
- 用户偏务实，不要过度打磨；有取舍直接说代价。

### 9.2 环境

```powershell
# git（不在 PATH 里）
C:\Users\wuchangqing\AppData\Local\Programs\MinGit\cmd\git.exe

# 仓库本地已有配置：http.sslBackend=openssl、http.proxy=http://127.0.0.1:10800
# 代理未开时直连也能连 GitHub（openssl 后端），但推送需要凭据：
#   系统凭据管理器里有 git:https://github.com（用户名 wuchangqing1103）
#   可用 CredRead 读出后用 http.extraheader 推送，或请用户开代理让 GCM 弹浏览器授权

# 部署验证（Python 走系统代理，能取到线上内容）
python -c "import urllib.request;print(urllib.request.urlopen('https://wuchangqing1103.github.io/jizhangqi/').read()[:200])"
```

### 9.3 已知坑

- `edit`/`write` 覆盖已存在文件偶发 `ReplaceFileW EIO (Win32 32)` → 用 pwsh 的 `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`。
- `write` 对「删了又重建」的文件报 `file no longer exists — re-read` → 换文件名。
- pwsh 打印中文乱码是控制台 GBK，不代表文件坏；用 `read` 校验。
- Vite dev server 在沙箱里 watcher 会 EBUSY 并返回旧模块（`MEMORY.md` 有记录）；验收优先用 `npm run build && npm run preview`。
- jsdom 没有真实布局：布局类断言不要依赖 `getBoundingClientRect`，改用结构断言 + 读 CSS 文本。

### 9.4 测试基线

当前 11 文件 / 69 用例，任何一批做完都必须 ≥ 本文预期数，且原有用例不得删除（改需求导致的除外，需在 commit 里说明）。

---

## 10. 附录：现有可复用样式

| 类名 | 用途 |
| --- | --- |
| `.modal-backdrop` / `.confirm-card` / `.confirm-actions` | 确认框、管理面板、备份面板共用的卡片 |
| `.record-list` / `.record-row` / `.cat-icon` | 账单行 |
| `.sheet-backdrop` / `.entry-sheet` / `.sheet-header` / `.sheet-body` / `.sheet-footer` | 记账浮层 |
| `.type-switch` | 支出/收入切换（记账面板与统计页共用） |
| `.toast` | 全局提示 |
| `.page-loading` | Suspense 占位 |
| 变量 | `--bg #f3f1ec`、`--ink #1e1c18`、`--ink-3 #6f6a61`、`--muted #9a9388`、`--line`、`--danger #a94a35`、`--green #1d7a5f`、`--accent #c96a3a`、`--radius-lg 26px` |

---

## 11. 一页速查（施工顺序）

1. **批次 1**：`styles.css`（动画 keyframes、`.entry-sheet` flex、`.category-grid` 5 列、`.toast` fixed、`.record-*` 手势样式）→ `EntrySheet.tsx`（结构 + 图标尺寸 + 备注聚焦滚动）→ `BillPage.tsx`（删两行小字、行结构重写、手势逻辑）→ 测试。
2. **批次 2**：`types.ts` → `storage.ts`（v2 + 迁移）→ `accounts.ts` → `seed.ts` → `backup.ts` → `App.tsx`（单 `ledger` 状态）→ `AccountBar.tsx` / `AccountPanel.tsx` / `EntrySheet` 归属 → 测试。
3. **批次 3**：`expression.ts` → `EntrySheet` 运算符键 + 预览 → `search.ts` → `BillPage` 搜索态 → 测试。
4. **批次 4**：`stats.ts` 对比函数 → `StatsPage` 对比卡 + 6 月柱状 → `csv.ts` → `BackupPanel` 按钮 → 测试。
5. 每批：`tsc` → `test` → `build` → commit → push → 线上验证 → 等用户验收。