import type { Account, LedgerState, RecordItem } from '../types'

/** key 沿用 v1，避免同一份数据出现两个真源 */
export const STORAGE_KEY = 'jizhangqi.v1'
export const STORAGE_VERSION = 2
/** 合并视图的筛选值 */
export const ALL_ACCOUNTS = 'all'

/** 新装/迁移时预置的账本，顺序即切换栏顺序 */
export const PRESET_ACCOUNTS: Account[] = [
  { id: 'acc-cash', name: '现金', color: '#8c8a83', createdAt: 0 },
  { id: 'acc-wechat', name: '微信', color: '#5f8f6a', createdAt: 0 },
  { id: 'acc-alipay', name: '支付宝', color: '#4a7fb0', createdAt: 0 },
  { id: 'acc-life', name: '生活', color: '#c08a4e', createdAt: 0 },
  { id: 'acc-work', name: '工作', color: '#7d7a92', createdAt: 0 },
]

/** v1 数据迁移后落到哪个账本：现金 */
export const DEFAULT_ACCOUNT_ID = PRESET_ACCOUNTS[0].id

export function clonePresetAccounts(): Account[] {
  return PRESET_ACCOUNTS.map((account) => ({ ...account }))
}

export function createEmptyLedger(): LedgerState {
  return { accounts: clonePresetAccounts(), activeAccountId: ALL_ACCOUNTS, records: [] }
}

/** v1 记录：除 accountId 外与现在一致 */
export type RecordItemV1 = Omit<RecordItem, 'accountId'>

interface LedgerPayloadV2 {
  version: typeof STORAGE_VERSION
  accounts: Account[]
  activeAccountId: string
  records: RecordItem[]
}

export type LedgerRead =
  | { status: 'missing' }
  | { status: 'ok'; ledger: LedgerState }
  | { status: 'invalid' }

function getDefaultStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function isAccount(value: unknown): value is Account {
  if (!isPlainObject(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.color === 'string' &&
    /^#[0-9a-fA-F]{6}$/.test(value.color) &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt)
  )
}

function isRecordShape(value: unknown): value is RecordItemV1 {
  if (!isPlainObject(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (value.type === 'expense' || value.type === 'income') &&
    typeof value.amount === 'number' &&
    Number.isInteger(value.amount) &&
    value.amount > 0 &&
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.date === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.date) &&
    typeof value.note === 'string' &&
    typeof value.createdAt === 'number' &&
    Number.isFinite(value.createdAt)
  )
}

/** v2 记录：在 v1 形状上多一个非空 accountId */
export function isRecordItem(value: unknown): value is RecordItem {
  return isRecordShape(value) && typeof (value as RecordItem).accountId === 'string' &&
    (value as RecordItem).accountId.length > 0
}

/** v1 记录：没有 accountId 也算合法，用于迁移与旧备份导入 */
export function isLegacyRecordItem(value: unknown): value is RecordItemV1 {
  return isRecordShape(value) && (value as Record<string, unknown>).accountId === undefined
}

/** v1 → v2：补一个默认账本，老记录全部落到「现金」 */
export function migrateV1(records: RecordItemV1[]): LedgerState {
  return {
    accounts: clonePresetAccounts(),
    activeAccountId: ALL_ACCOUNTS,
    records: records.map((record) => ({ ...record, accountId: DEFAULT_ACCOUNT_ID })),
  }
}

function readV2(payload: Record<string, unknown>): LedgerRead {
  if (!Array.isArray(payload.accounts) || payload.accounts.length === 0) return { status: 'invalid' }
  if (!payload.accounts.every(isAccount)) return { status: 'invalid' }
  if (!Array.isArray(payload.records) || !payload.records.every(isRecordItem)) {
    return { status: 'invalid' }
  }

  const accounts = payload.accounts as Account[]
  const ids = new Set(accounts.map((account) => account.id))
  // 账本 id 重复会让归属判断失去意义
  if (ids.size !== accounts.length) return { status: 'invalid' }

  const fallbackId = accounts[0].id
  const records = (payload.records as RecordItem[]).map((record) =>
    ids.has(record.accountId) ? record : { ...record, accountId: fallbackId },
  )

  const active =
    typeof payload.activeAccountId === 'string' &&
    (payload.activeAccountId === ALL_ACCOUNTS || ids.has(payload.activeAccountId))
      ? payload.activeAccountId
      : fallbackId

  return { status: 'ok', ledger: { accounts, activeAccountId: active, records } }
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
    if (!isPlainObject(parsed)) return { status: 'invalid' }

    if (parsed.version === 1) {
      if (!Array.isArray(parsed.records) || !parsed.records.every(isLegacyRecordItem)) {
        return { status: 'invalid' }
      }
      return { status: 'ok', ledger: migrateV1(parsed.records) }
    }

    if (parsed.version === STORAGE_VERSION) return readV2(parsed)

    return { status: 'invalid' }
  } catch {
    return { status: 'invalid' }
  }
}

export function writeLedger(
  ledger: LedgerState,
  storage: Storage | null = getDefaultStorage(),
): boolean {
  if (!storage) return false
  const payload: LedgerPayloadV2 = {
    version: STORAGE_VERSION,
    accounts: ledger.accounts,
    activeAccountId: ledger.activeAccountId,
    records: ledger.records,
  }
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