import { describe, expect, it } from 'vitest'
import type { Account, RecordItem } from '../types'
import {
  ACCOUNT_COLORS,
  MAX_ACCOUNT_NAME,
  createAccount,
  filterByAccount,
  lastUsedAccountId,
  moveRecords,
  removeAccountPlan,
  renameAccount,
} from './accounts'
import { ALL_ACCOUNTS, DEFAULT_ACCOUNT_ID, PRESET_ACCOUNTS } from './storage'

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'acc-a',
    name: '现金',
    color: '#8c8a83',
    createdAt: 0,
    ...overrides,
  }
}

function record(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r1',
    type: 'expense',
    amount: 1000,
    category: 'food',
    date: '2026-11-07',
    note: '',
    createdAt: 100,
    accountId: DEFAULT_ACCOUNT_ID,
    ...overrides,
  }
}

describe('createAccount', () => {
  it('正常新增：去掉首尾空格，分配没被占用的颜色', () => {
    const result = createAccount('  旅行  ', [account()], 1000)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.account.name).toBe('旅行')
    expect(result.account.id).not.toBe('acc-a')
    expect(ACCOUNT_COLORS).toContain(result.account.color)
    expect(result.account.createdAt).toBe(1000)
  })

  it('空名字被拒绝', () => {
    expect(createAccount('   ', [account()])).toEqual({ ok: false, error: 'empty' })
  })

  it(`超过 ${MAX_ACCOUNT_NAME} 个字被拒绝`, () => {
    expect(createAccount('一二三四五六七八九', [account()])).toEqual({
      ok: false,
      error: 'too-long',
    })
    expect(createAccount('一二三四五六七八', [account()]).ok).toBe(true)
  })

  it('重名被拒绝（不区分大小写、忽略首尾空格）', () => {
    expect(createAccount(' 现金 ', [account()])).toEqual({ ok: false, error: 'duplicate' })
    expect(createAccount('Cash', [account({ name: 'cash' })])).toEqual({
      ok: false,
      error: 'duplicate',
    })
  })

  it('生成的 id 不会与已有账本冲突', () => {
    const existing = [account(), account({ id: 'acc-b' })]
    const ids = new Set(existing.map((item) => item.id))
    for (let i = 0; i < 20; i += 1) {
      const result = createAccount(`新${i}`, existing, 1000)
      expect(result.ok).toBe(true)
      if (result.ok) expect(ids.has(result.account.id)).toBe(false)
    }
  })
})

describe('renameAccount', () => {
  const accounts = [
    account({ id: 'acc-a', name: '现金' }),
    account({ id: 'acc-b', name: '微信', color: '#5f8f6a' }),
  ]

  it('改名成功返回新数组', () => {
    const next = renameAccount(accounts, 'acc-a', '零钱')
    expect(next).not.toBe(accounts)
    expect(next.find((item) => item.id === 'acc-a')?.name).toBe('零钱')
  })

  it('名字非法或重名时原样返回同一引用，便于调用方判错', () => {
    expect(renameAccount(accounts, 'acc-a', '')).toBe(accounts)
    expect(renameAccount(accounts, 'acc-a', '一二三四五六七八九')).toBe(accounts)
    expect(renameAccount(accounts, 'acc-a', '微信')).toBe(accounts)
    expect(renameAccount(accounts, 'acc-missing', '零钱')).toBe(accounts)
  })
})

describe('removeAccountPlan / moveRecords', () => {
  const accounts = [
    account({ id: 'acc-a', name: '现金' }),
    account({ id: 'acc-b', name: '微信' }),
  ]

  it('算出会牵连多少条记录、转到哪个账本', () => {
    const records = [record({ id: 'r1', accountId: 'acc-a' }), record({ id: 'r2', accountId: 'acc-b' })]
    expect(removeAccountPlan(accounts, records, 'acc-a')).toEqual({
      target: accounts[1],
      affected: 1,
    })
  })

  it('只剩一个账本时没有可转移目标', () => {
    const records = [record({ accountId: 'acc-a' })]
    expect(removeAccountPlan([accounts[0]], records, 'acc-a').target).toBeNull()
  })

  it('转移后记录数守恒，且只改归属', () => {
    const records = [
      record({ id: 'r1', accountId: 'acc-a' }),
      record({ id: 'r2', accountId: 'acc-b' }),
      record({ id: 'r3', accountId: 'acc-a' }),
    ]
    const moved = moveRecords(records, 'acc-a', 'acc-b')
    expect(moved).toHaveLength(records.length)
    expect(moved.every((item) => item.accountId === 'acc-b')).toBe(true)
    expect(records[0].accountId).toBe('acc-a')
  })

  it('起止相同时原样返回', () => {
    const records = [record({ accountId: 'acc-a' })]
    expect(moveRecords(records, 'acc-a', 'acc-a')).toBe(records)
  })
})

describe('filterByAccount / lastUsedAccountId', () => {
  const records = [
    record({ id: 'r1', createdAt: 300, accountId: 'acc-b' }),
    record({ id: 'r2', createdAt: 100, accountId: 'acc-a' }),
  ]

  it('全部返回原数组，指定账本只留自己的', () => {
    expect(filterByAccount(records, ALL_ACCOUNTS)).toBe(records)
    expect(filterByAccount(records, 'acc-a').map((item) => item.id)).toEqual(['r2'])
  })

  it('取最近一次记录所属的账本', () => {
    expect(lastUsedAccountId(PRESET_ACCOUNTS, records)).toBe('acc-b')
  })

  it('没有记录时退回第一个账本', () => {
    expect(lastUsedAccountId(PRESET_ACCOUNTS, [])).toBe(PRESET_ACCOUNTS[0].id)
  })
})