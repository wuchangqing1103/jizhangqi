import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, Wallet } from 'lucide-react'
import type { RecordDraft, RecordItem, Tab } from './types'
import { currentMonthKey, monthOf } from './lib/date'
import { initialRecords, resetToSeed } from './lib/seed'
import { writeLedger } from './lib/storage'
import { BillPage } from './components/BillPage'
import { BottomNav } from './components/BottomNav'
import { ConfirmDialog } from './components/ConfirmDialog'
import { EntrySheet } from './components/EntrySheet'
import { MonthSwitcher } from './components/MonthSwitcher'
import { MoreMenu } from './components/MoreMenu'
import { StatsPage } from './components/StatsPage'
import { Toast } from './components/Toast'

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const [records, setRecords] = useState<RecordItem[]>(() => initialRecords())
  const [tab, setTab] = useState<Tab>('bill')
  const [month, setMonth] = useState(currentMonthKey())
  const [sheet, setSheet] = useState<{ record: RecordItem | null } | null>(null)
  const [confirmRecord, setConfirmRecord] = useState<RecordItem | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastTimer = useRef<number | null>(null)

  useEffect(() => {
    writeLedger(records)
  }, [records])

  useEffect(() => {
    return () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    }
  }, [])

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
      setRecords((prev) => prev.map((item) => (item.id === editing.id ? { ...item, ...draft } : item)))
    } else {
      const item: RecordItem = { ...draft, id: createId(), createdAt: Date.now() }
      setRecords((prev) => [item, ...prev])
    }
    setMonth(monthOf(draft.date))
    setTab('bill')
    setSheet(null)
    showToast(editing ? '已更新记录' : '已记一笔')
  }

  function handleDelete() {
    if (!confirmRecord) return
    const id = confirmRecord.id
    setRecords((prev) => prev.filter((item) => item.id !== id))
    if (sheet?.record?.id === id) setSheet(null)
    setConfirmRecord(null)
    showToast('已删除记录')
  }

  function handleClear() {
    setRecords([])
    setConfirmClear(false)
    setSheet(null)
    setTab('bill')
    showToast('账本已清空')
  }

  function handleReset() {
    setRecords(resetToSeed())
    setMonth(currentMonthKey())
    setTab('bill')
    setMenuOpen(false)
    setSheet(null)
    showToast('示例账单已恢复')
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

        <main className="app-main">
          {tab === 'bill' ? (
            <BillPage
              month={month}
              records={records}
              onEdit={(record) => setSheet({ record })}
              onAdd={openNewEntry}
            />
          ) : (
            <StatsPage month={month} records={records} />
          )}
        </main>

        <BottomNav tab={tab} onChange={setTab} onAdd={openNewEntry} />

        {menuOpen && (
          <MoreMenu
            onClose={() => setMenuOpen(false)}
            onReset={handleReset}
            onClear={() => {
              setMenuOpen(false)
              setConfirmClear(true)
            }}
          />
        )}

        {sheet && (
          <EntrySheet
            key={sheet.record?.id ?? 'new'}
            record={sheet.record}
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
    </div>
  )
}