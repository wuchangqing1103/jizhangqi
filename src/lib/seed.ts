import type { RecordItem, RecordType } from '../types'
import { addDays, addMonths, currentMonthKey, monthOf, parseDate, toDateStr } from './date'
import { readLedger, writeLedger } from './storage'

interface Template {
  offset: number
  type: RecordType
  amount: number
  category: string
  note: string
}

const CURRENT_MONTH_TEMPLATES: Template[] = [
  { offset: 0, type: 'expense', amount: 950, category: 'food', note: '豆浆油条' },
  { offset: 0, type: 'expense', amount: 600, category: 'transport', note: '地铁通勤' },
  { offset: 0, type: 'expense', amount: 2800, category: 'food', note: '公司楼下' },
  { offset: 0, type: 'expense', amount: 2200, category: 'food', note: '下午一杯' },
  { offset: 1, type: 'expense', amount: 800, category: 'food', note: '早餐' },
  { offset: 1, type: 'expense', amount: 600, category: 'transport', note: '地铁' },
  { offset: 1, type: 'expense', amount: 2600, category: 'food', note: '午饭' },
  { offset: 1, type: 'expense', amount: 1600, category: 'food', note: '奶茶' },
  { offset: 2, type: 'expense', amount: 2100, category: 'food', note: '咖啡' },
  { offset: 2, type: 'expense', amount: 3200, category: 'food', note: '午饭' },
  { offset: 2, type: 'expense', amount: 2600, category: 'transport', note: '打车' },
  { offset: 2, type: 'expense', amount: 16890, category: 'shopping', note: '超市采购' },
  { offset: 3, type: 'expense', amount: 750, category: 'food', note: '早餐' },
  { offset: 3, type: 'expense', amount: 2400, category: 'food', note: '午饭' },
  { offset: 3, type: 'expense', amount: 18600, category: 'housing', note: '水电费' },
  { offset: 3, type: 'expense', amount: 6800, category: 'study', note: '买书' },
  { offset: 4, type: 'expense', amount: 600, category: 'transport', note: '地铁' },
  { offset: 4, type: 'expense', amount: 1990, category: 'food', note: '午饭' },
  { offset: 4, type: 'expense', amount: 4580, category: 'medical', note: '药品' },
  { offset: 5, type: 'expense', amount: 1000, category: 'food', note: '早餐' },
  { offset: 5, type: 'expense', amount: 2300, category: 'food', note: '午饭' },
  { offset: 5, type: 'expense', amount: 15600, category: 'social', note: '朋友聚餐' },
  { offset: 5, type: 'expense', amount: 1200, category: 'other', note: '快递' },
  { offset: 6, type: 'expense', amount: 1800, category: 'food', note: '咖啡' },
  { offset: 6, type: 'expense', amount: 600, category: 'transport', note: '地铁' },
  { offset: 6, type: 'expense', amount: 2700, category: 'food', note: '午饭' },
]

const PREVIOUS_MONTH_TEMPLATES: Array<Omit<Template, 'offset'> & { day: string }> = [
  { day: '01', type: 'income', amount: 1850000, category: 'salary', note: '月度工资' },
  { day: '02', type: 'expense', amount: 320000, category: 'housing', note: '房租' },
  { day: '03', type: 'expense', amount: 900, category: 'food', note: '早餐' },
  { day: '03', type: 'expense', amount: 600, category: 'transport', note: '地铁' },
  { day: '04', type: 'expense', amount: 2500, category: 'food', note: '午饭' },
  { day: '05', type: 'expense', amount: 21040, category: 'shopping', note: '超市' },
  { day: '06', type: 'expense', amount: 1900, category: 'food', note: '咖啡' },
  { day: '08', type: 'expense', amount: 15800, category: 'housing', note: '水电费' },
  { day: '09', type: 'expense', amount: 6800, category: 'fun', note: '电影' },
  { day: '10', type: 'expense', amount: 3000, category: 'food', note: '午饭' },
  { day: '11', type: 'expense', amount: 2800, category: 'transport', note: '打车' },
  { day: '12', type: 'expense', amount: 5500, category: 'study', note: '买书' },
  { day: '14', type: 'expense', amount: 18800, category: 'social', note: '朋友聚餐' },
  { day: '15', type: 'expense', amount: 3200, category: 'medical', note: '药品' },
  { day: '16', type: 'expense', amount: 9650, category: 'shopping', note: '超市' },
  { day: '18', type: 'expense', amount: 800, category: 'food', note: '早餐' },
  { day: '19', type: 'expense', amount: 2600, category: 'food', note: '午饭' },
  { day: '20', type: 'expense', amount: 2100, category: 'food', note: '咖啡' },
  { day: '21', type: 'expense', amount: 600, category: 'transport', note: '地铁' },
  { day: '22', type: 'expense', amount: 29900, category: 'shopping', note: '衣服' },
  { day: '24', type: 'expense', amount: 4580, category: 'food', note: '水果' },
  { day: '25', type: 'expense', amount: 6000, category: 'housing', note: '网费' },
  { day: '26', type: 'income', amount: 120000, category: 'parttime', note: '兼职结算' },
  { day: '27', type: 'expense', amount: 1600, category: 'food', note: '奶茶' },
  { day: '28', type: 'expense', amount: 4500, category: 'fun', note: '电影' },
]

function createdAtAt(dateStr: string, minutes: number, now: Date): number {
  const base = parseDate(dateStr).getTime() + 8 * 60 * 60 * 1000
  const candidate = base + minutes * 60 * 1000
  return Math.min(candidate, now.getTime() - 60 * 1000)
}

/** 演示用示例账本：当月近 7 天 + 上月整月，都是相对「今天」生成的 */
export function createSeedRecords(now: Date = new Date()): RecordItem[] {
  const monthKey = currentMonthKey(now)
  const today = toDateStr(now)
  const previousMonth = addMonths(monthKey, -1)
  const records: RecordItem[] = []
  let sequence = 0

  const push = (
    date: string,
    type: RecordType,
    amount: number,
    category: string,
    note: string,
    minutes: number,
  ) => {
    sequence += 1
    records.push({
      id: `seed-${sequence}`,
      type,
      amount,
      category,
      date,
      note,
      createdAt: createdAtAt(date, minutes, now),
    })
  }

  push(`${monthKey}-01`, 'income', 1850000, 'salary', '月度工资', 0)
  push(`${monthKey}-01`, 'expense', 320000, 'housing', '房租', 5)
  if (today >= `${monthKey}-05`) {
    push(`${monthKey}-05`, 'income', 80000, 'parttime', '兼职结算', 10)
  }

  for (const template of CURRENT_MONTH_TEMPLATES) {
    const date = addDays(today, -template.offset)
    if (monthOf(date) !== monthKey) continue
    push(date, template.type, template.amount, template.category, template.note, 30 + template.offset * 20)
  }

  for (const template of PREVIOUS_MONTH_TEMPLATES) {
    push(
      `${previousMonth}-${template.day}`,
      template.type,
      template.amount,
      template.category,
      template.note,
      60 + Number(template.day) * 5,
    )
  }

  return records
}

/** 首次打开（本地没有账本）时写入示例数据；已有数据或损坏数据不动 */
export function initialRecords(now: Date = new Date()): RecordItem[] {
  const read = readLedger()
  if (read.status === 'ok') return read.records
  if (read.status === 'missing') {
    const seeded = createSeedRecords(now)
    writeLedger(seeded)
    return seeded
  }
  return []
}

export function resetToSeed(now: Date = new Date()): RecordItem[] {
  const seeded = createSeedRecords(now)
  writeLedger(seeded)
  return seeded
}