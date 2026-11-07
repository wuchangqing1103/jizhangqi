const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const pad2 = (value: number) => String(value).padStart(2, '0')

export function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function todayStr(now: Date = new Date()): string {
  return toDateStr(now)
}

export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7)
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
}

export function addMonths(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1, 12)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function addDays(dateStr: string, delta: number): string {
  const date = parseDate(dateStr)
  date.setDate(date.getDate() + delta)
  return toDateStr(date)
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${year}年${month}月`
}

export function weekdayLabel(dateStr: string): string {
  return WEEKDAYS[parseDate(dateStr).getDay()]
}

export function relativeDay(dateStr: string, today: string = todayStr()): string {
  if (dateStr === today) return '今天'
  if (dateStr === addDays(today, -1)) return '昨天'
  return ''
}

export function dayLabel(dateStr: string): string {
  const date = parseDate(dateStr)
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function compareMonth(a: string, b: string): number {
  return a === b ? 0 : a > b ? 1 : -1
}

export function isFutureMonth(monthKey: string, today: string = todayStr()): boolean {
  return compareMonth(monthKey, monthOf(today)) > 0
}

export function lastDayOfMonth(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month, 0, 12).getDate()
}