import type { CSSProperties } from 'react'
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
}

export function BillPage({ month, records, onEdit, onAdd }: BillPageProps) {
  const monthItems = monthRecords(records, month)
  const summary = summarize(monthItems)
  const groups = groupByDay(monthItems)
  const expense = splitCents(summary.expense)

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
        <span>{summary.count > 0 ? '点条目可编辑' : '还没有记录'}</span>
      </div>

      {groups.length === 0 ? (
        <EmptyBill onAdd={onAdd} />
      ) : (
        groups.map((group) => (
          <DaySection key={group.date} group={group} onEdit={onEdit} />
        ))
      )}
    </section>
  )
}

function DaySection({
  group,
  onEdit,
}: {
  group: DayGroup
  onEdit: (record: RecordItem) => void
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
        <div className="day-totals">
          {group.expense > 0 && <span>支出 ¥{formatCents(group.expense)}</span>}
          {group.income > 0 && <span className="income">收入 ¥{formatCents(group.income)}</span>}
        </div>
      </div>
      <ul className="record-list">
        {group.records.map((record) => (
          <li key={record.id}>
            <RecordRow record={record} onEdit={onEdit} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function RecordRow({
  record,
  onEdit,
}: {
  record: RecordItem
  onEdit: (record: RecordItem) => void
}) {
  const category = findCategory(record.category)
  const name = category?.name ?? '其他'
  const label = record.note ? `编辑 ${name} ${record.note}` : `编辑 ${name}`

  return (
    <button type="button" className="record-row" aria-label={label} onClick={() => onEdit(record)}>
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