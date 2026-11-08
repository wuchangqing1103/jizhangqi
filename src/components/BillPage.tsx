import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Receipt } from 'lucide-react'
import type { DayGroup, RecordItem } from '../types'
import { findCategory } from '../data/categories'
import {
  currentMonthKey,
  dayLabel,
  lastDayOfMonth,
  monthLabel,
  relativeDay,
  todayStr,
  weekdayLabel,
} from '../lib/date'
import { formatCents, splitCents } from '../lib/format'
import { groupByDay, monthRecords, summarize } from '../lib/stats'
import { CategoryIcon } from './CategoryIcon'

interface BillPageProps {
  month: string
  records: RecordItem[]
  onEdit: (record: RecordItem) => void
  onAdd: () => void
  onRequestDelete: (record: RecordItem) => void
}

/** 左滑露出删除按钮的位移上限 */
const MAX_OFFSET = 84
/** 越过这个位移就吸附打开 */
const OPEN_THRESHOLD = 40
/** 长按多久算删除意图 */
const LONG_PRESS_MS = 500
/** 位移小于它视为误触；纵向优先判断用于让页面正常滚动 */
const CANCEL_MOVE = 8
/** 滑到多远时垃圾桶图标完全显形，再往后只增加红底宽度 */
const REVEAL_DISTANCE = 56

interface GestureStart {
  x: number
  y: number
  /** 手势开始时的位移：关闭是 0，已打开是 -84，从打开态接着往右拖才对得上 */
  base: number
  moved: boolean
  longFired: boolean
  /** 一旦判定为纵向滚页，这次手势就不再跟手 */
  vertical: boolean
}

function clampOffset(value: number): number {
  return Math.max(-MAX_OFFSET, Math.min(0, value))
}

export function BillPage({ month, records, onEdit, onAdd, onRequestDelete }: BillPageProps) {
  const monthItems = monthRecords(records, month)
  const summary = summarize(monthItems)
  const groups = groupByDay(monthItems)
  const expense = splitCents(summary.expense)
  const [openId, setOpenId] = useState<string | null>(null)

  // 同时只开一行：页面一滚动就收起（scroll 不冒泡，用捕获阶段监听所有滚动容器）
  useEffect(() => {
    const closeOpenRow = () => setOpenId(null)
    document.addEventListener('scroll', closeOpenRow, true)
    return () => document.removeEventListener('scroll', closeOpenRow, true)
  }, [])

  useEffect(() => {
    setOpenId(null)
  }, [month])

  return (
    <section className="page bill-page" aria-label={`${monthLabel(month)}账单`}>
      <div className="summary-card">
        <div className="summary-label">
          <span>本月支出</span>
          <span className="summary-caption">共 {summary.count} 笔</span>
        </div>
        <div className="summary-amount">
          <span className="summary-currency">¥</span>
          {expense.integer}
          {expense.fraction && <span className="summary-fraction">.{expense.fraction}</span>}
        </div>
        <div className="summary-divider" />
        <div className="summary-meta">
          <div>
            <span>收入</span>
            <strong>¥{formatCents(summary.income)}</strong>
          </div>
          <div>
            <span>结余</span>
            <strong className={summary.balance < 0 ? 'negative' : ''}>
              {summary.balance < 0 ? '-' : ''}¥{formatCents(Math.abs(summary.balance))}
            </strong>
          </div>
          <div>
            <span>日均支出</span>
            <strong>¥{formatCents(averagePerDay(month, summary.expense))}</strong>
          </div>
        </div>
      </div>

      <div className="list-heading">
        <h2>账单明细</h2>
      </div>

      {groups.length === 0 ? (
        <EmptyBill onAdd={onAdd} />
      ) : (
        groups.map((group) => (
          <DaySection
            key={group.date}
            group={group}
            openId={openId}
            onOpenChange={setOpenId}
            onEdit={onEdit}
            onRequestDelete={onRequestDelete}
          />
        ))
      )}
    </section>
  )
}

function DaySection({
  group,
  openId,
  onOpenChange,
  onEdit,
  onRequestDelete,
}: {
  group: DayGroup
  openId: string | null
  onOpenChange: (id: string | null) => void
  onEdit: (record: RecordItem) => void
  onRequestDelete: (record: RecordItem) => void
}) {
  const relative = relativeDay(group.date)

  return (
    <div className="day-group">
      <div className="day-header">
        <div className="day-date-wrap">
          {relative && <span className="day-relative">{relative}</span>}
          <span className="day-date">{dayLabel(group.date)}</span>
          <span className="day-week">{weekdayLabel(group.date)}</span>
        </div>
      </div>
      <ul className="record-list">
        {group.records.map((record) => (
          <RecordRow
            key={record.id}
            record={record}
            open={openId === record.id}
            onOpenChange={onOpenChange}
            onEdit={onEdit}
            onRequestDelete={onRequestDelete}
          />
        ))}
      </ul>
    </div>
  )
}

function RecordRow({
  record,
  open,
  onOpenChange,
  onEdit,
  onRequestDelete,
}: {
  record: RecordItem
  open: boolean
  onOpenChange: (id: string | null) => void
  onEdit: (record: RecordItem) => void
  onRequestDelete: (record: RecordItem) => void
}) {
  const category = findCategory(record.category)
  const name = category?.name ?? '其他'
  const label = record.note ? `编辑 ${name} ${record.note}` : `编辑 ${name}`
  const deleteLabel = record.note ? `删除 ${name} ${record.note}` : `删除 ${name}`
  // 拖拽中的实时位移；null 表示没在拖，位置由 open 决定
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<GestureStart | null>(null)
  const longPressTimer = useRef<number | null>(null)
  // 滑动或长按之后浏览器仍会补一次 click，用它把这次 click 吞掉
  const suppressClick = useRef(false)

  const translate = drag ?? (open ? -MAX_OFFSET : 0)
  // 0 → 收起，1 → 完全露出：垃圾桶图标随滑动淡入并从右侧轻微滑入
  const reveal = Math.min(1, Math.max(0, -translate / REVEAL_DISTANCE))

  useEffect(() => {
    return () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
    }
  }, [])

  function clearLongPress() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    suppressClick.current = false
    start.current = {
      x: event.clientX,
      y: event.clientY,
      base: open ? -MAX_OFFSET : 0,
      moved: false,
      longFired: false,
      vertical: false,
    }
    // jsdom 没有 setPointerCapture，可选调用兜底
    event.currentTarget.setPointerCapture?.(event.pointerId)
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      const gesture = start.current
      if (!gesture || gesture.moved) return
      gesture.longFired = true
      suppressClick.current = true
      onOpenChange(null)
      onRequestDelete(record)
    }, LONG_PRESS_MS)
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const gesture = start.current
    if (!gesture || gesture.vertical) return
    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    const absX = Math.abs(dx)
    const absY = Math.abs(dy)

    // 纵向优先：判定为滚页就整体作废，不跟页面抢手势
    if (absY > absX && absY > CANCEL_MOVE) {
      gesture.vertical = true
      gesture.moved = true
      clearLongPress()
      setDrag(null)
      return
    }
    if (absX > CANCEL_MOVE) {
      gesture.moved = true
      clearLongPress()
    }
    if (absX > absY) {
      setDrag(clampOffset(gesture.base + dx))
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLButtonElement>) {
    const gesture = start.current
    start.current = null
    clearLongPress()
    if (!gesture) return

    if (gesture.moved || gesture.longFired) suppressClick.current = true
    if (gesture.longFired || !gesture.moved) {
      setDrag(null)
      return
    }

    const dx = event.clientX - gesture.x
    const dy = event.clientY - gesture.y
    if (Math.abs(dy) > Math.abs(dx)) {
      setDrag(null)
      return
    }
    const next = clampOffset(gesture.base + dx)
    onOpenChange(next <= -OPEN_THRESHOLD ? record.id : null)
    setDrag(null)
  }

  function handlePointerCancel() {
    start.current = null
    clearLongPress()
    setDrag(null)
  }

  function handleClick() {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (open) {
      onOpenChange(null)
      return
    }
    onEdit(record)
  }

  const swiped = translate < -4

  return (
    <li className={swiped ? 'record-item is-swiped' : 'record-item'}>
      <div
        className="record-swipe"
        style={{
          transform: `translateX(${translate}px)`,
          transition: drag === null ? undefined : 'none',
        }}
      >
        <button
          type="button"
          className="record-row"
          aria-label={label}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span
            className="cat-icon"
            style={{ '--cat': category?.color ?? '#8c8a83' } as CSSProperties}
          >
            <CategoryIcon id={record.category} />
          </span>
          <span className="record-body">
            <span className="record-title">{name}</span>
            {record.note && <span className="record-note">{record.note}</span>}
          </span>
          <span className={`record-amount ${record.type}`}>
            {record.type === 'expense' ? '-' : '+'}¥{formatCents(record.amount)}
          </span>
        </button>
      </div>
      <button
        type="button"
        className="record-delete"
        aria-label={deleteLabel}
        tabIndex={open ? 0 : -1}
        onClick={() => {
          onOpenChange(null)
          onRequestDelete(record)
        }}
      >
        <span
          className="record-delete-inner"
          style={{
            opacity: reveal,
            transform: `translateX(${(1 - reveal) * 8}px) scale(${0.94 + 0.06 * reveal})`,
            transition: drag === null ? undefined : 'none',
          }}
        >
          <svg
            className="trash-glyph"
            viewBox="0 0 24 24"
            width={20}
            height={20}
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M6.3 9.3h11.4a1.5 1.5 0 0 1 1.5 1.5l-.9 8.1a2.4 2.4 0 0 1-2.4 2.1H8.1a2.4 2.4 0 0 1-2.4-2.1l-.9-8.1a1.5 1.5 0 0 1 1.5-1.5Z
                 M10.15 12.3a1.15 1.15 0 0 1 1.15 1.15v4.5a1.15 1.15 0 0 1-2.3 0v-4.5a1.15 1.15 0 0 1 1.15-1.15Z
                 M13.85 12.3A1.15 1.15 0 0 1 15 13.45v4.5a1.15 1.15 0 0 1-2.3 0v-4.5a1.15 1.15 0 0 1 1.15-1.15Z
                 M10.05 3.5h3.9a1.4 1.4 0 0 1 1.4 1.4v.7h-6.7v-.7a1.4 1.4 0 0 1 1.4-1.4Z
                 M6.1 5.6h11.8a1.4 1.4 0 0 1 0 2.8H6.1a1.4 1.4 0 0 1 0-2.8Z"
            />
          </svg>
          <span>删除</span>
        </span>
      </button>
    </li>
  )
}

function EmptyBill({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Receipt size={24} strokeWidth={1.6} aria-hidden="true" />
      </div>
      <h3>这个月还没有记录</h3>
      <p>点下面的 +，先记第一笔。</p>
      <button type="button" className="empty-action" onClick={onAdd}>
        记第一笔
      </button>
    </div>
  )
}

function averagePerDay(month: string, expense: number): number {
  const days =
    month === currentMonthKey() ? Number(todayStr().slice(8, 10)) : lastDayOfMonth(month)
  return days === 0 ? 0 : Math.round(expense / days)
}