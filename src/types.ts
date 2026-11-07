export type RecordType = 'expense' | 'income'

export interface RecordItem {
  id: string
  type: RecordType
  amount: number
  category: string
  date: string
  note: string
  createdAt: number
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
}