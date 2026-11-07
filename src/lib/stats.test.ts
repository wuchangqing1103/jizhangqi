import { describe, expect, it } from 'vitest'
import type { RecordItem } from '../types'
import { categoryBreakdown, groupByDay, monthRecords, summarize } from './stats'

function record(overrides: Partial<RecordItem> & Pick<RecordItem, 'id' | 'type' | 'amount' | 'date'>): RecordItem {
  return {
    category: 'food',
    note: '',
    createdAt: 0,
    ...overrides,
  }
}

const records: RecordItem[] = [
  record({ id: 'a', type: 'expense', amount: 1250, date: '2026-11-07', createdAt: 100 }),
  record({ id: 'b', type: 'expense', amount: 600, date: '2026-11-07', createdAt: 200 }),
  record({ id: 'c', type: 'income', amount: 1850000, date: '2026-11-06', category: 'salary', createdAt: 50 }),
  record({ id: 'd', type: 'expense', amount: 3000, date: '2026-10-31', createdAt: 10 }),
]

describe('monthRecords', () => {
  it('只保留指定月份', () => {
    expect(monthRecords(records, '2026-11').map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('summarize', () => {
  it('汇总收支、结余和笔数', () => {
    expect(summarize(records)).toEqual({
      expense: 4850,
      income: 1850000,
      balance: 1845150,
      count: 4,
    })
  })

  it('空账本返回全 0', () => {
    expect(summarize([])).toEqual({ expense: 0, income: 0, balance: 0, count: 0 })
  })
})

describe('groupByDay', () => {
  it('按日期倒序、同日按创建时间倒序', () => {
    const groups = groupByDay(records)
    expect(groups.map((group) => group.date)).toEqual(['2026-11-07', '2026-11-06', '2026-10-31'])
    expect(groups[0].records.map((item) => item.id)).toEqual(['b', 'a'])
    expect(groups[0]).toMatchObject({ expense: 1850, income: 0 })
    expect(groups[1]).toMatchObject({ expense: 0, income: 1850000 })
  })
})

describe('categoryBreakdown', () => {
  it('按金额倒序汇总分类并计算占比', () => {
    const result = categoryBreakdown(monthRecords(records, '2026-11'), 'expense')
    expect(result[0]).toMatchObject({ category: 'food', amount: 1850, count: 2, percent: 100 })

    const mixed = categoryBreakdown(
      [
        record({ id: 'x', type: 'expense', amount: 600, date: '2026-11-01', category: 'transport' }),
        record({ id: 'y', type: 'expense', amount: 1200, date: '2026-11-02', category: 'food' }),
      ],
      'expense',
    )
    expect(mixed.map((item) => item.category)).toEqual(['food', 'transport'])
    expect(mixed.map((item) => Math.round(item.percent))).toEqual([67, 33])
  })

  it('金额相同时按分类定义顺序', () => {
    const result = categoryBreakdown(
      [
        record({ id: 'x', type: 'expense', amount: 500, date: '2026-11-01', category: 'transport' }),
        record({ id: 'y', type: 'expense', amount: 500, date: '2026-11-02', category: 'food' }),
      ],
      'expense',
    )
    expect(result.map((item) => item.category)).toEqual(['food', 'transport'])
  })

  it('没有该类型记录时返回空数组', () => {
    expect(categoryBreakdown(records, 'income')).toHaveLength(1)
    expect(categoryBreakdown([], 'expense')).toEqual([])
  })
})