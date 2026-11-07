import type { RecordItem } from '../types'
import { isRecordItem } from './storage'

export const BACKUP_APP = 'jizhangqi'
export const BACKUP_VERSION = 1

export interface BackupFile {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  records: RecordItem[]
}

export type BackupParseResult =
  | { ok: true; records: RecordItem[]; total: number; skipped: number }
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

export function buildBackup(records: RecordItem[], now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    records: records.map((record) => ({ ...record })),
  }
}

function fail(error: string): BackupParseResult {
  return { ok: false, error }
}

/**
 * 解析备份文件。除了带 app/exportedAt 的信封，也接受直接导出的
 * 本地存储 payload（{ version, records }），方便手工恢复。
 * 记录逐条校验：坏的跳过并计数，不让一条脏数据毁掉整次导入。
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

  if (payload.version !== undefined && payload.version !== BACKUP_VERSION) {
    return fail(`备份版本 ${String(payload.version)} 与当前版本不兼容`)
  }

  if (!Array.isArray(payload.records)) {
    return fail('文件里没有账单记录')
  }

  const records: RecordItem[] = []
  let skipped = 0
  for (const item of payload.records) {
    if (isRecordItem(item)) records.push({ ...item })
    else skipped += 1
  }

  if (payload.records.length > 0 && records.length === 0) {
    return fail('备份里没有能识别的记录')
  }

  return { ok: true, records, total: payload.records.length, skipped }
}