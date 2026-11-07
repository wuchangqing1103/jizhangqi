import type { CategoryTotal, DayGroup, RecordItem, RecordType } from '../types'
import { getCategories } from '../data/categories'

export function monthRecords(records: RecordItem[], monthKey: string): RecordItem[] {
  return records.filter((record) => record.date.startsWith(monthKey))
}

export function summarize(records: RecordItem[]): {
  expense: number
  income: number
  balance: number
  count: number
} {
  let expense = 0
  let income = 0
  for (const record of records) {
    if (record.type === 'expense') expense += record.amount
    else income += record.amount
  }
  return { expense, income, balance: income - expense, count: records.length }
}

function sortRecords(records: RecordItem[]): RecordItem[] {
  return [...records].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  )
}

export function groupByDay(records: RecordItem[]): DayGroup[] {
  const groups = new Map<string, DayGroup>()
  for (const record of sortRecords(records)) {
    let group = groups.get(record.date)
    if (!group) {
      group = { date: record.date, records: [], expense: 0, income: 0 }
      groups.set(record.date, group)
    }
    group.records.push(record)
    if (record.type === 'expense') group.expense += record.amount
    else group.income += record.amount
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date))
}

export function categoryBreakdown(records: RecordItem[], type: RecordType): CategoryTotal[] {
  const totals = new Map<string, { amount: number; count: number }>()
  let total = 0
  for (const record of records) {
    if (record.type !== type) continue
    const current = totals.get(record.category) ?? { amount: 0, count: 0 }
    current.amount += record.amount
    current.count += 1
    totals.set(record.category, current)
    total += record.amount
  }

  const order = new Map(getCategories(type).map((category, index) => [category.id, index]))
  return [...totals.entries()]
    .map(([category, value]) => ({
      category,
      amount: value.amount,
      count: value.count,
      percent: total === 0 ? 0 : (value.amount / total) * 100,
    }))
    .sort(
      (a, b) =>
        b.amount - a.amount ||
        (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99),
    )
}