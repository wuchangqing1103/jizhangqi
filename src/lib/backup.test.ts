import { describe, expect, it } from 'vitest'
import type { Account, RecordItem } from '../types'
import { ALL_ACCOUNTS, DEFAULT_ACCOUNT_ID, PRESET_ACCOUNTS } from './storage'
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
    accountId: DEFAULT_ACCOUNT_ID,
    ...overrides,
  }
}

function withoutAccount(record: RecordItem): Record<string, unknown> {
  const { accountId: _ignored, ...rest } = record
  return rest
}

const accounts: Account[] = PRESET_ACCOUNTS.map((account) => ({ ...account }))

describe('buildBackup', () => {
  it('生成 v2 信封（含账本），往返解析后账本与记录等价', () => {
    const now = new Date('2026-11-07T08:50:00.000Z')
    const records = [
      makeRecord(),
      makeRecord({ id: 'r2', type: 'income', category: 'salary', accountId: 'acc-work' }),
    ]

    const backup = buildBackup({ accounts, records }, now)
    expect(backup.app).toBe('jizhangqi')
    expect(backup.version).toBe(2)
    expect(backup.exportedAt).toBe('2026-11-07T08:50:00.000Z')
    expect(backup.accounts).toHaveLength(accounts.length)
    expect(backup.records).toEqual(records)
    // 导出不应共享引用：之后再改账本不能污染备份对象
    expect(backup.records[0]).not.toBe(records[0])
    expect(backup.accounts[0]).not.toBe(accounts[0])

    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.ledger.accounts).toEqual(accounts)
    expect(parsed.ledger.records).toEqual(records)
    expect(parsed.ledger.activeAccountId).toBe(ALL_ACCOUNTS)
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
  it('导入 v1 老备份：自动迁移到预置账本，记录一条不少', () => {
    const records = [makeRecord(), makeRecord({ id: 'r2', note: '地铁' })].map(withoutAccount)
    const parsed = parseBackup(JSON.stringify({ app: 'jizhangqi', version: 1, records }))

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.ledger.records).toHaveLength(2)
    expect(parsed.ledger.records.every((item) => item.accountId === DEFAULT_ACCOUNT_ID)).toBe(true)
    expect(parsed.ledger.records[0].note).toBe('午饭')
    expect(parsed.ledger.accounts).toHaveLength(PRESET_ACCOUNTS.length)
  })

  it('同时接受本地存储的裸 payload（无 app 字段）', () => {
    const records = [withoutAccount(makeRecord())]
    const parsed = parseBackup(JSON.stringify({ version: 1, records }))

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.ledger.records).toHaveLength(1)
  })

  it('v2 里不认识的账本回落到第一个账本，不丢记录', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'jizhangqi',
        version: 2,
        accounts,
        records: [makeRecord({ accountId: 'acc-ghost' })],
      }),
    )

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.ledger.records[0].accountId).toBe(accounts[0].id)
  })

  it('v2 缺少账本信息报错', () => {
    const parsed = parseBackup(JSON.stringify({ app: 'jizhangqi', version: 2, records: [] }))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('账本')
  })

  it('v2 账本 id 重复报错', () => {
    const parsed = parseBackup(
      JSON.stringify({
        app: 'jizhangqi',
        version: 2,
        accounts: [accounts[0], { ...accounts[1], id: accounts[0].id }],
        records: [makeRecord()],
      }),
    )
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('重复')
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
    const parsed = parseBackup(JSON.stringify({ version: 3, records: [makeRecord()] }))
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain('3')
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
          withoutAccount(makeRecord()),
          { id: 'bad', type: 'expense', amount: -1 },
          'oops',
          withoutAccount(makeRecord({ id: 'r2', note: '地铁' })),
        ],
      }),
    )

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.ledger.records.map((record) => record.id)).toEqual(['r1', 'r2'])
    expect(parsed.total).toBe(4)
    expect(parsed.skipped).toBe(2)
  })

  it('全部记录都无效时报错', () => {
    const parsed = parseBackup(JSON.stringify({ version: 1, records: [{ id: '' }] }))
    expect(parsed.ok).toBe(false)
  })
})