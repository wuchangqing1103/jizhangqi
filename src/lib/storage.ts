import type { RecordItem } from '../types'

export const STORAGE_KEY = 'jizhangqi.v1'

interface LedgerPayload {
  version: 1
  records: RecordItem[]
}

export type LedgerRead =
  | { status: 'missing' }
  | { status: 'ok'; records: RecordItem[] }
  | { status: 'invalid' }

function getDefaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function isRecordItem(value: unknown): value is RecordItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    (item.type === 'expense' || item.type === 'income') &&
    typeof item.amount === 'number' &&
    Number.isInteger(item.amount) &&
    item.amount > 0 &&
    typeof item.category === 'string' &&
    item.category.length > 0 &&
    typeof item.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
    typeof item.note === 'string' &&
    typeof item.createdAt === 'number' &&
    Number.isFinite(item.createdAt)
  )
}

/** 读取本地账本；任何异常都退化成可预期的状态，不抛错 */
export function readLedger(storage: Storage | null = getDefaultStorage()): LedgerRead {
  if (!storage) return { status: 'missing' }
  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'invalid' }
  }
  if (raw === null) return { status: 'missing' }

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { status: 'invalid' }
    const payload = parsed as Record<string, unknown>
    if (payload.version !== 1) return { status: 'invalid' }
    if (!Array.isArray(payload.records)) return { status: 'invalid' }
    if (!payload.records.every(isRecordItem)) return { status: 'invalid' }
    return { status: 'ok', records: payload.records }
  } catch {
    return { status: 'invalid' }
  }
}

export function writeLedger(
  records: RecordItem[],
  storage: Storage | null = getDefaultStorage(),
): boolean {
  if (!storage) return false
  const payload: LedgerPayload = { version: 1, records }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}

export function removeLedger(storage: Storage | null = getDefaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略：存储不可用时不影响内存中的账本 */
  }
}