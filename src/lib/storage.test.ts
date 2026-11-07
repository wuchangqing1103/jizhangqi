import { beforeEach, describe, expect, it } from 'vitest'
import type { RecordItem } from '../types'
import { STORAGE_KEY, readLedger, removeLedger, writeLedger } from './storage'

const sample: RecordItem = {
  id: 'r1',
  type: 'expense',
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

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('没有数据时返回 missing', () => {
    expect(readLedger()).toEqual({ status: 'missing' })
  })

  it('写入后可以原样读回', () => {
    expect(writeLedger([sample])).toBe(true)
    expect(readLedger()).toEqual({ status: 'ok', records: [sample] })
  })

  it('坏 JSON 退化为 invalid', () => {
    localStorage.setItem(STORAGE_KEY, '{oops')
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('版本不符退化为 invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, records: [] }))
    expect(readLedger()).toEqual({ status: 'invalid' })
  })

  it('记录字段不合法退化为 invalid', () => {
    const bad = [
      { ...sample, amount: 12.5 },
      { ...sample, amount: 0 },
      { ...sample, amount: -100 },
      { ...sample, date: '2026/11/07' },
      { ...sample, id: '' },
      { ...sample, note: undefined },
      { ...sample, type: 'transfer' },
    ]
    for (const item of bad) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records: [item] }))
      expect(readLedger()).toEqual({ status: 'invalid' })
    }
  })

  it('存储不可用时读取返回 invalid、写入返回 false', () => {
    const broken = brokenStorage()
    expect(readLedger(broken)).toEqual({ status: 'invalid' })
    expect(writeLedger([sample], broken)).toBe(false)
    expect(() => removeLedger(broken)).not.toThrow()
  })

  it('removeLedger 清空数据', () => {
    writeLedger([sample])
    removeLedger()
    expect(readLedger()).toEqual({ status: 'missing' })
  })
})