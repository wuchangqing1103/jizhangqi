export type RecordType = 'expense' | 'income'

/** 账本（资金源/用途的扁平归类），每笔记录必须归属一个 */
export interface Account {
  id: string
  name: string
  color: string
  createdAt: number
}

export interface RecordItem {
  id: string
  type: RecordType
  amount: number
  category: string
  date: string
  note: string
  createdAt: number
  accountId: string
}

/** 'all' 表示合并视图，其余值是 Account.id */
export type AccountFilter = string

export interface LedgerState {
  accounts: Account[]
  activeAccountId: AccountFilter
  records: RecordItem[]
}

export interface DayGroup {
  date: string
  records: RecordItem[]
  expense: number
  income: number
}

export interface CategoryTotal {
  category: string
  amount: number
  count: number
  percent: number
}

export type Tab = 'bill' | 'stats'

export interface RecordDraft {
  type: RecordType
  amount: number
  category: string
  date: string
  note: string
  accountId: string
}