import { describe, expect, it } from 'vitest'
import type { RecordItem } from '../types'
import { backupFileName, buildBackup, parseBackup } from './backup'

function makeRecord(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r1',
    type: 'expense',
    amount: 1250,
    category: 'food',
    date: '2026-11-07',
    note: '午饭',
    createdAt: 1794031200000,
    ...overrides,
  }
}

describe('buildBackup', () => {
  it('生成带 app / version / exportedAt 的信封，往返解析后记录等价', () => {
    const now = new Date('2026-11-07T08:50:00.000Z')
    const records = [makeRecord(), makeRecord({ id: 'r2', type: 'income', category: 'salary' })]

    const backup = buildBackup(records, now)
    expect(backup.app).toBe('jizhangqi')
    expect(backup.version).toBe(1)
    expect(backup.exportedAt).toBe('2026-11-07T08:50:00.000Z')
    expect(backup.records).toEqual(records)
    // 导出不应共享引用：之后再改账本不能污染备份对象
    expect(backup.records[0]).not.toBe(records[0])

    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.records).toEqual(records)
    expect(parsed.skipped).toBe(0)
    expect(parsed.total).toBe(2)
  })
})

describe('backupFileName', () => {
  it('用本地时间生成 ASCII 文件名', () => {
    expect(backupFileName(new Date(2026, 10, 7, 16, 50))).toBe(
      'jizhangqi-backup-20261107-1650.json',
    )
  })
})

describe('parseBackup', () => {
  it('同时接受本地存储的裸 payload', () => {
    const records = [makeRecord()]
    const parsed = parseBackup(JSON.stringify({ version: 1, records }))

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.records).toEqual(records)
  })

  it('非法 JSON 报错', () => {
    const parsed = parseBackup('{ not json')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('JSON')
  })

  it('缺 records 报错', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'jizhangqi', version: 1 }))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('没有账单记录')
  })

  it('版本不符报错', () => {
    const parsed = parseBackup(JSON.stringify({ version: 2, records: [makeRecord()] }))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('2')
  })

  it('别的 App 的备份报错', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'other', version: 1, records: [] }))
    expect(parsed.ok).toBe(false)
  })

  it('按条跳过无效记录并计数', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'jizhangqi',
        version: 1,
        records: [
          makeRecord(),
          { id: 'bad', type: 'expense', amount: -1 },
          'oops',
          makeRecord({ id: 'r2', note: '地铁' }),
        ],
      }),
    )

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.records.map((record) => record.id)).toEqual(['r1', 'r2'])
    expect(parsed.total).toBe(4)
    expect(parsed.skipped).toBe(2)
  })

  it('全部记录都无效时报错', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, records: [{ id: '' }] }))
    expect(parsed.ok).toBe(false)
  })
})