import { beforeEach, describe, expect, it } from 'vitest'
import { currentMonthKey } from './date'
import { STORAGE_KEY, readLedger } from './storage'
import { createSeedRecords, resetToSeed } from './seed'

const now = new Date(2026, 10, 7, 12, 0, 0)
const monthKey = currentMonthKey(now)

describe('createSeedRecords', () => {
  it('生成当月和上月的演示账单', () => {
    const records = createSeedRecords(now)
    expect(records.length).toBeGreaterThan(30)
    expect(records.some((item) => item.date.startsWith(monthKey))).toBe(true)
    expect(records.some((item) => item.date.startsWith('2026-10'))).toBe(true)
  })

  it('所有记录都是合法数据', () => {
    const records = createSeedRecords(now)
    for (const item of records) {
      expect(item.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isInteger(item.amount)).toBe(true)
      expect(item.amount).toBeGreaterThan(0)
      expect(item.createdAt).toBeLessThanOrEqual(now.getTime())
      expect(item.id).toMatch(/^seed-\d+$/)
    }
  })

  it('当月包含工资、房租和兼职收入', () => {
    const records = createSeedRecords(now)
    const notes = records.map((item) => item.note)
    expect(notes).toContain('月度工资')
    expect(notes).toContain('房租')
    expect(notes).toContain('兼职结算')
  })

  it('今天在月初时不会生成未来日期的记录', () => {
    const firstDay = new Date(2026, 10, 1, 9, 0, 0)
    const records = createSeedRecords(firstDay)
    expect(records.every((item) => item.date <= '2026-11-01')).toBe(true)
  })
})

describe('resetToSeed', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('写入示例账单并可通过 storage 读回', () => {
    const records = resetToSeed(now)
    expect(records).toHaveLength(createSeedRecords(now).length)
    const read = readLedger()
    expect(read.status).toBe('ok')
    if (read.status === 'ok') expect(read.records).toHaveLength(records.length)
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })
})