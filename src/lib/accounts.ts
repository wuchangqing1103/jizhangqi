import type { Account, AccountFilter, RecordItem } from '../types'
import { ALL_ACCOUNTS } from './storage'

export const MAX_ACCOUNT_NAME = 8

/** 账本色点调色板，按顺序取第一个没被占用的颜色 */
export const ACCOUNT_COLORS = [
  '#8c8a83',
  '#5f8f6a',
  '#4a7fb0',
  '#c08a4e',
  '#7d7a92',
  '#a4646b',
  '#5b8c8c',
  '#8a6f9e',
]

export type CreateAccountError = 'empty' | 'too-long' | 'duplicate'

export type CreateAccountResult =
  | { ok: true; account: Account }
  | { ok: false; error: CreateAccountError }

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function nameLength(name: string): number {
  return [...name].length
}

function sameName(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase()
}

function hasDuplicate(name: string, accounts: Account[], exceptId?: string): boolean {
  return accounts.some(
    (account) => account.id !== exceptId && sameName(account.name, name),
  )
}

function pickColor(accounts: Account[]): string {
  const used = new Set(accounts.map((account) => account.color))
  return ACCOUNT_COLORS.find((color) => !used.has(color)) ?? ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length]
}

function accountId(now: number, accounts: Account[]): string {
  const seed = Math.random().toString(36).slice(2, 6)
  let candidate = `acc-${now.toString(36)}-${seed}`
  let suffix = 1
  const taken = new Set(accounts.map((account) => account.id))
  while (taken.has(candidate)) {
    candidate = `acc-${now.toString(36)}-${seed}${suffix}`
    suffix += 1
  }
  return candidate
}

/** 新增账本：名称 1–8 字、去首尾空格、不区分大小写查重 */
export function createAccount(
  name: string,
  existing: Account[],
  now: number = Date.now(),
): CreateAccountResult {
  const normalized = normalizeName(name)
  if (normalized === '') return { ok: false, error: 'empty' }
  if (nameLength(normalized) > MAX_ACCOUNT_NAME) return { ok: false, error: 'too-long' }
  if (hasDuplicate(normalized, existing)) return { ok: false, error: 'duplicate' }

  return {
    ok: true,
    account: {
      id: accountId(now, existing),
      name: normalized,
      color: pickColor(existing),
      createdAt: now,
    },
  }
}

/** 改名：名字不合规或重名时原样返回（引用不变，调用方可据此提示） */
export function renameAccount(accounts: Account[], id: string, name: string): Account[] {
  const normalized = normalizeName(name)
  if (normalized === '' || nameLength(normalized) > MAX_ACCOUNT_NAME) return accounts
  const target = accounts.find((account) => account.id === id)
  if (!target || target.name === normalized) return accounts
  if (hasDuplicate(normalized, accounts, id)) return accounts
  return accounts.map((account) => (account.id === id ? { ...account, name: normalized } : account))
}

export interface RemoveAccountPlan {
  target: Account | null
  affected: number
}

/** 删前算：该账本有多少条记录、要转到哪个账本（第一个不是自己的） */
export function removeAccountPlan(
  accounts: Account[],
  records: RecordItem[],
  id: string,
): RemoveAccountPlan {
  const target = accounts.find((account) => account.id !== id) ?? null
  const affected = records.filter((record) => record.accountId === id).length
  return { target, affected }
}

/** 把记录从一个账本转到另一个，条数不变 */
export function moveRecords(records: RecordItem[], from: string, to: string): RecordItem[] {
  if (from === to) return records
  return records.map((record) => (record.accountId === from ? { ...record, accountId: to } : record))
}

export function filterByAccount(records: RecordItem[], filter: AccountFilter): RecordItem[] {
  if (filter === ALL_ACCOUNTS) return records
  return records.filter((record) => record.accountId === filter)
}

/** 取「全部」视图下新记录该落到哪个账本：最近一次真实用过的 */
export function lastUsedAccountId(accounts: Account[], records: RecordItem[]): string {
  let latest: RecordItem | null = null
  for (const record of records) {
    if (!latest || record.createdAt > latest.createdAt) latest = record
  }
  return latest?.accountId ?? accounts[0]?.id ?? ''
}