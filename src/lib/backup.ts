import type { Account, LedgerState, RecordItem } from '../types'
import {
  ALL_ACCOUNTS,
  isAccount,
  isLegacyRecordItem,
  isRecordItem,
  migrateV1,
} from './storage'

export const BACKUP_APP = 'jizhangqi'
export const BACKUP_VERSION = 2

export interface BackupFile {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  accounts: Account[]
  records: RecordItem[]
}

export interface BackupLedger {
  accounts: Account[]
  records: RecordItem[]
}

export type BackupParseResult =
  | { ok: true; ledger: LedgerState; total: number; skipped: number }
  | { ok: false; error: string }

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 文件名只用 ASCII，避免 iOS/微信保存时把中文名弄乱 */
export function backupFileName(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
    now.getHours(),
  )}${pad(now.getMinutes())}`
  return `jizhangqi-backup-${stamp}.json`
}

export function buildBackup(ledger: BackupLedger, now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    accounts: ledger.accounts.map((account) => ({ ...account })),
    records: ledger.records.map((record) => ({ ...record })),
  }
}

function fail(error: string): BackupParseResult {
  return { ok: false, error }
}

function readVersion1(records: unknown[], total: number): BackupParseResult {
  const valid: Array<Omit<RecordItem, 'accountId'>> = []
  for (const item of records) {
    if (isLegacyRecordItem(item)) valid.push({ ...item })
  }
  if (total > 0 && valid.length === 0) return fail('备份里没有能识别的记录')
  return { ok: true, ledger: migrateV1(valid), total, skipped: total - valid.length }
}

function readVersion2(payload: Record<string, unknown>, total: number): BackupParseResult {
  if (!Array.isArray(payload.accounts) || payload.accounts.length === 0) {
    return fail('备份里没有账本信息')
  }
  if (!payload.accounts.every(isAccount)) return fail('备份里的账本信息不完整')

  const accounts = (payload.accounts as Account[]).map((account) => ({ ...account }))
  const ids = new Set(accounts.map((account) => account.id))
  if (ids.size !== accounts.length) return fail('备份里的账本有重复')
  const fallbackId = accounts[0].id

  const records: RecordItem[] = []
  for (const item of payload.records as unknown[]) {
    if (!isRecordItem(item)) continue
    records.push(ids.has(item.accountId) ? { ...item } : { ...item, accountId: fallbackId })
  }
  if (total > 0 && records.length === 0) return fail('备份里没有能识别的记录')

  return {
    ok: true,
    ledger: { accounts, records, activeAccountId: ALL_ACCOUNTS },
    total,
    skipped: total - records.length,
  }
}

/**
 * 解析备份文件。v2 信封带 accounts；也接受 v1（自动迁移到「现金」）和
 * 直接导出的本地存储 payload。记录逐条校验：坏的跳过并计数，
 * 不认识账本的记录落到第一个账本，绝不因为一条脏数据毁掉整次导入。
 */
export function parseBackup(text: string): BackupParseResult {
  if (text.trim() === '') return fail('文件是空的')

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail('文件不是有效的 JSON')
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return fail('文件内容不是记账备份')
  }

  const payload = data as Record<string, unknown>

  if (payload.app !== undefined && payload.app !== BACKUP_APP) {
    return fail('这不是记账器的备份文件')
  }

  const version = payload.version === undefined ? 1 : payload.version
  if (version !== 1 && version !== BACKUP_VERSION) {
    return fail(`备份版本 ${String(payload.version)} 与当前版本不兼容`)
  }

  if (!Array.isArray(payload.records)) {
    return fail('文件里没有账单记录')
  }

  return version === 1
    ? readVersion1(payload.records, payload.records.length)
    : readVersion2(payload, payload.records.length)
}