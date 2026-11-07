import type { RecordType } from '../types'

export interface Category {
  id: string
  name: string
  type: RecordType
  color: string
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'food', name: '餐饮', type: 'expense', color: '#dd7a3f' },
  { id: 'transport', name: '交通', type: 'expense', color: '#4f7fbf' },
  { id: 'shopping', name: '购物', type: 'expense', color: '#bf5f88' },
  { id: 'housing', name: '居住', type: 'expense', color: '#8b7857' },
  { id: 'fun', name: '娱乐', type: 'expense', color: '#8d63bd' },
  { id: 'medical', name: '医疗', type: 'expense', color: '#4c9689' },
  { id: 'study', name: '学习', type: 'expense', color: '#5d7f4b' },
  { id: 'social', name: '人情', type: 'expense', color: '#c46868' },
  { id: 'other', name: '其他', type: 'expense', color: '#8c8a83' },
]

export const INCOME_CATEGORIES: Category[] = [
  { id: 'salary', name: '工资', type: 'income', color: '#2c7f63' },
  { id: 'bonus', name: '奖金', type: 'income', color: '#b08434' },
  { id: 'invest', name: '理财', type: 'income', color: '#4380a8' },
  { id: 'parttime', name: '兼职', type: 'income', color: '#6d8140' },
  { id: 'income-other', name: '其他', type: 'income', color: '#8c8a83' },
]

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]

export function getCategories(type: RecordType): Category[] {
  return type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
}

export function findCategory(id: string): Category | undefined {
  return ALL_CATEGORIES.find((category) => category.id === id)
}

export function fallbackCategory(type: RecordType): Category {
  const categories = getCategories(type)
  return categories[categories.length - 1]
}