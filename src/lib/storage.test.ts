import { beforeEach, describe, expect, it } from 'vitest'
import type { LedgerState } from '../types'
import {
  ALL_ACCOUNTS,
  DEFAULT_ACCOUNT_ID,
  PRESET_ACCOUNTS,
  STORAGE_KEY,
  readLedger,
  removeLedger,
  writeLedger,
} from './storage'

const legacyRecord = {
  id: 'r1',
  type: 'expense' as const,
  amount: 1250,
  category: 'food',
  date: '2026-11-07',
  note: '午饭',
  createdAt: 1762480000000,
}

function brokenStorage(): Storage {
  return {
    get length() {
      return 0
    },
    clear() {},
    getItem() {
      throw new Error('blocked')
    },
    key() {
      return null
    },
    removeItem() {
      throw new Error('blocked')
    },
    setItem() {
      throw new Error('blocked')
    },
  } as Storage
}

function ledgerOf(records: LedgerState['records'] = []): LedgerState {
  return {
    accounts: PRESET_ACCOUNTS.map((account) => ({ ...account })),
    activeAccountId: ALL_ACCOUNTS,
    records,
  }
}

describe('storage v2', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('没有数据时返回 missing', () => {
    expect(readLedger()).toEqual({ status: 'missing' })
  })

  it('写入后可以原样读回', () => {
    const ledger = ledgerOf([
      { ...legacyRecord, accountId: DEFAULT_ACCOUNT_ID },
    ])
    expect(writeLedger(ledger)).toBe(true)
    expect(readLedger()).toEqual({ status: 'ok', ledger })
  })

  it('写入的永远是 version 2 信封', () => {
    writeLedger(ledgerOf())
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(raw.version).toBe(2)
    expect(raw.activeAccountId).toBe(ALL_ACCOUNTS)
    expect(raw.accounts).toHaveLength(PRESET_ACCOUNTS.length)
  })

  it('v1 老数据自动迁移：记录一条不少，全部落到现金账本', () => {
    const second = { ...legacyRecord, id: 'r2', amount: 800, note: '地铁' }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: [legacyRecord, second] }))

    const read = readLedger()
    expect(read.status).toBe('ok')
    if (read.status !== 'ok') return
    expect(read.ledger.records).toHaveLength(2)
    expect(read.ledger.records.every((item) => item.accountId === DEFAULT_ACCOUNT_ID)).toBe(true)
    expect(read.ledger.records[0]).toMatchObject(legacyRecord)
    expect(read.ledger.activeAccountId).toBe(ALL_ACCOUNTS)
    expect(read.ledger.accounts).toHaveLength(PRESET_ACCOUNTS.length)
  })

  it('v1 记录不合法退化为 invalid', () => {
    const bad = [
      { ...legacyRecord, amount: 12.5 },
      { ...legacyRecord, amount: 0 },
      { ...legacyRecord, date: '2026/11/07' },
      { ...legacyRecord, id: '' },
      { ...legacyRecord, note: undefined },
      { ...legacyRecord, type: 'transfer' },
    ]
    for (const item of bad) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: [item] }))
      expect(readLedger()).toEqual({ status: 'invalid' })
    }
  })

  it('坏 JSON 退化为 invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('未知版本号退化为 invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3, records: [] }))
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('v2 里缺少账本信息退化为 invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, accounts: [], records: [] }))
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('未知 accountId 回落到第一个账本，记录不丢', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        accounts: PRESET_ACCOUNTS,
        activeAccountId: ALL_ACCOUNTS,
        records: [{ ...legacyRecord, accountId: 'acc-ghost' }],
      }),
    )
    const read = readLedger()
    expect(read.status).toBe('ok')
    if (read.status !== 'ok') return
    expect(read.ledger.records).toHaveLength(1)
    expect(read.ledger.records[0].accountId).toBe(PRESET_ACCOUNTS[0].id)
  })

  it('activeAccountId 失效时回退到第一个账本', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        accounts: PRESET_ACCOUNTS,
        activeAccountId: 'acc-ghost',
        records: [],
      }),
    )
    const read = readLedger()
    expect(read.status).toBe('ok')
    if (read.status !== 'ok') return
    expect(read.ledger.activeAccountId).toBe(PRESET_ACCOUNTS[0].id)
  })

  it('账本 id 重复退化为 invalid（避免同一笔记录归属歧义）', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        accounts: [PRESET_ACCOUNTS[0], { ...PRESET_ACCOUNTS[1], id: PRESET_ACCOUNTS[0].id }],
        activeAccountId: ALL_ACCOUNTS,
        records: [],
      }),
    )
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('存储不可用时读取返回 invalid、写入返回 false', () => {
    const broken = brokenStorage()
    expect(readLedger(broken)).toEqual({ status: 'invalid' })
    expect(writeLedger(ledgerOf(), broken)).toBe(false)
    expect(() => removeLedger(broken)).not.toThrow()
  })

  it('removeLedger 清空数据', () => {
    writeLedger(ledgerOf())
    removeLedger()
    expect(readLedger()).toEqual({ status: 'missing' })
  })
})