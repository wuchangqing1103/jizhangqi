import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal, Wallet } from 'lucide-react'
import type { Account, AccountFilter, LedgerState, RecordDraft, RecordItem, Tab } from './types'
import { currentMonthKey, monthOf } from './lib/date'
import { initialLedger } from './lib/seed'
import { writeLedger, ALL_ACCOUNTS } from './lib/storage'
import {
  createAccount,
  filterByAccount,
  lastUsedAccountId,
  moveRecords,
  renameAccount,
  removeAccountPlan,
} from './lib/accounts'
import { AccountBar } from './components/AccountBar'
import { AccountPanel } from './components/AccountPanel'
import { BillPage } from './components/BillPage'
import { BottomNav } from './components/BottomNav'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntrySheet } from './components/EntrySheet'
import { MonthSwitcher } from './components/MonthSwitcher'
import { MoreMenu } from './components/MoreMenu'
import { Toast } from './components/Toast'

// 统计页和备份面板不是首屏必需，拆成独立 chunk，先把账单页放出来
const StatsPage = lazy(() =>
  import('./components/StatsPage').then((module) => ({ default: module.StatsPage })),
)
const BackupPanel = lazy(() =>
  import('./components/BackupPanel').then((module) => ({ default: module.BackupPanel })),
)

interface ConfirmAccount {
  account: Account
  target: Account
  affected: number
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const CREATE_ERRORS: Record<string, string> = {
  empty: '账本名不能为空',
  'too-long': '账本名最多 8 个字',
  duplicate: '已经有同名账本了',
}

export default function App() {
  const [ledger, setLedger] = useState<LedgerState>(() => initialLedger())
  const [tab, setTab] = useState<Tab>('bill')
  const [month, setMonth] = useState(currentMonthKey())
  const [sheet, setSheet] = useState<{ record: RecordItem | null } | null>(null)
  const [confirmRecord, setConfirmRecord] = useState<RecordItem | null>(null)
  const [confirmAccount, setConfirmAccount] = useState<ConfirmAccount | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [backupOpen, setBackupOpen] = useState(false)
  const [accountsOpen, setAccountsOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastTimer = useRef<number | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    writeLedger(ledger)
  }, [ledger])

  // 记账面板打开时锁住页面滚动，避免背景跟着一起动、也不让页面被键盘顶起来
  useEffect(() => {
    document.body.classList.toggle('sheet-open', sheet !== null)
    return () => document.body.classList.remove('sheet-open')
  }, [sheet])

  // 任一模态弹层（确认框 / 备份 / 账本管理）打开时也锁住背景，点击与滚动都不下漏
  const modalOpen =
    confirmRecord !== null || confirmAccount !== null || confirmClear || backupOpen || accountsOpen

  useEffect(() => {
    document.body.classList.toggle('modal-open', modalOpen)
    return () => document.body.classList.remove('modal-open')
  }, [modalOpen])

  // 切页面或切月份时回到顶部，避免沿用上一页的滚动位置
  useEffect(() => {
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [tab, month])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

  const visibleRecords = useMemo(
    () => filterByAccount(ledger.records, ledger.activeAccountId),
    [ledger],
  )

  const defaultAccountId = useMemo(
    () =>
      ledger.activeAccountId === ALL_ACCOUNTS
        ? lastUsedAccountId(ledger.accounts, ledger.records)
        : ledger.activeAccountId,
    [ledger],
  )

  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const record of ledger.records) {
      counts[record.accountId] = (counts[record.accountId] ?? 0) + 1
    }
    return counts
  }, [ledger.records])

  function showToast(message: string) {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message })
    toastTimer.current = window.setTimeout(() => setToast(null), 2200)
  }

  function openNewEntry() {
    setMenuOpen(false)
    setSheet({ record: null })
  }

  function handleSubmit(draft: RecordDraft) {
    const editing = sheet?.record ?? null
    if (editing) {
      setLedger((prev) => ({
        ...prev,
        records: prev.records.map((item) => (item.id === editing.id ? { ...item, ...draft } : item)),
      }))
    } else {
      const item: RecordItem = { ...draft, id: createId(), createdAt: Date.now() }
      setLedger((prev) => ({ ...prev, records: [item, ...prev.records] }))
    }
    setMonth(monthOf(draft.date))
    setTab('bill')
    setSheet(null)
    showToast(editing ? '已更新记录' : '已记一笔')
  }

  function handleDelete() {
    if (!confirmRecord) return
    const id = confirmRecord.id
    setLedger((prev) => ({ ...prev, records: prev.records.filter((item) => item.id !== id) }))
    if (sheet?.record?.id === id) setSheet(null)
    setConfirmRecord(null)
    showToast('已删除记录')
  }

  function handleClear() {
    setLedger((prev) => ({ ...prev, records: [] }))
    setConfirmClear(false)
    setSheet(null)
    setTab('bill')
    showToast('账本已清空')
  }

  function handleImport(imported: { accounts: Account[]; records: RecordItem[] }) {
    // 整账本替换：不做按 id 合并，避免新旧数据混杂
    setLedger({
      accounts: imported.accounts,
      records: imported.records,
      activeAccountId: ALL_ACCOUNTS,
    })
    setBackupOpen(false)
    setMonth(currentMonthKey())
    setTab('bill')
    setSheet(null)
    showToast(`已导入 ${imported.records.length} 条记录`)
  }

  function handleSwitchAccount(filter: AccountFilter) {
    setLedger((prev) => ({ ...prev, activeAccountId: filter }))
  }

  function handleCreateAccount(name: string): string | null {
    const result = createAccount(name, ledger.accounts)
    if (!result.ok) return CREATE_ERRORS[result.error] ?? '账本名不合规'
    setLedger((prev) => ({ ...prev, accounts: [...prev.accounts, result.account] }))
    showToast(`已新增账本「${result.account.name}」`)
    return null
  }

  function handleRenameAccount(id: string, name: string): string | null {
    const next = renameAccount(ledger.accounts, id, name)
    if (next === ledger.accounts) return '名字不合规或与已有账本重名'
    setLedger((prev) => ({ ...prev, accounts: next }))
    showToast('账本已改名')
    return null
  }

  function removeAccount(account: Account, target: Account) {
    setLedger((prev) => ({
      accounts: prev.accounts.filter((item) => item.id !== account.id),
      records: moveRecords(prev.records, account.id, target.id),
      activeAccountId:
        prev.activeAccountId === account.id ? target.id : prev.activeAccountId,
    }))
    setConfirmAccount(null)
    showToast(`已删除账本「${account.name}」`)
  }

  function handleRequestRemoveAccount(id: string) {
    const account = ledger.accounts.find((item) => item.id === id)
    if (!account) return
    const plan = removeAccountPlan(ledger.accounts, ledger.records, id)
    if (!plan.target) {
      showToast('至少要留一个账本')
      return
    }
    if (plan.affected === 0) {
      removeAccount(account, plan.target)
      return
    }
    setConfirmAccount({ account, target: plan.target, affected: plan.affected })
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <header className="app-header">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <Wallet size={14} strokeWidth={2} />
            </span>
            <span className="brand-name">记账器</span>
            <span className="demo-pill">DEMO</span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="更多操作"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <MonthSwitcher month={month} onChange={setMonth} />

        <AccountBar
          accounts={ledger.accounts}
          active={ledger.activeAccountId}
          onChange={handleSwitchAccount}
          onManage={() => setAccountsOpen(true)}
        />

        <main className="app-main" ref={mainRef}>
          <Suspense fallback={<div className="page-loading" aria-hidden="true" />}>
            {tab === 'bill' ? (
              <BillPage
                month={month}
                records={visibleRecords}
                onEdit={(record) => setSheet({ record })}
                onAdd={openNewEntry}
                onRequestDelete={setConfirmRecord}
              />
            ) : (
              <StatsPage month={month} records={visibleRecords} />
            )}
          </Suspense>
        </main>

        <BottomNav tab={tab} onChange={setTab} onAdd={openNewEntry} />

        {menuOpen && (
          <MoreMenu
            onClose={() => setMenuOpen(false)}
            onBackup={() => {
              setMenuOpen(false)
              setBackupOpen(true)
            }}
            onClear={() => {
              setMenuOpen(false)
              setConfirmClear(true)
            }}
          />
        )}

        {backupOpen && (
          <Suspense fallback={null}>
            <BackupPanel
              accounts={ledger.accounts}
              records={ledger.records}
              onClose={() => setBackupOpen(false)}
              onImport={handleImport}
            />
          </Suspense>
        )}

        {accountsOpen && (
          <AccountPanel
            accounts={ledger.accounts}
            counts={accountCounts}
            onClose={() => setAccountsOpen(false)}
            onCreate={handleCreateAccount}
            onRename={handleRenameAccount}
            onRemove={handleRequestRemoveAccount}
          />
        )}

        {sheet && (
          <EntrySheet
            key={sheet.record?.id ?? 'new'}
            record={sheet.record}
            accounts={ledger.accounts}
            defaultAccountId={defaultAccountId}
            onClose={() => setSheet(null)}
            onSubmit={handleSubmit}
            onRequestDelete={setConfirmRecord}
          />
        )}

        {confirmRecord && (
          <ConfirmDialog
            title="删除这笔记录？"
            message="删除后无法恢复，这笔记录会从账本中移除。"
            confirmLabel="删除"
            onCancel={() => setConfirmRecord(null)}
            onConfirm={handleDelete}
          />
        )}

        {confirmAccount && (
          <ConfirmDialog
            title={`删除账本「${confirmAccount.account.name}」？`}
            message={`${confirmAccount.affected} 条记录会转到「${confirmAccount.target.name}」，记录不会丢失。`}
            confirmLabel="删除账本"
            onCancel={() => setConfirmAccount(null)}
            onConfirm={() => removeAccount(confirmAccount.account, confirmAccount.target)}
          />
        )}

        {confirmClear && (
          <ConfirmDialog
            title="清空整个账本？"
            message="所有记录都会被删除，且无法恢复。"
            confirmLabel="清空"
            onCancel={() => setConfirmClear(false)}
            onConfirm={handleClear}
          />
        )}

        {toast && <Toast key={toast.id} message={toast.message} />}
      </div>

      {/* 遮罩常驻在 body 上，只切透明度：每次打开不再新建合成层，iOS 顶部那条就不会闪 */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div
            className={modalOpen ? 'modal-scrim is-open' : 'modal-scrim'}
            aria-hidden="true"
          />,
          document.body,
        )}
    </div>
  )
}