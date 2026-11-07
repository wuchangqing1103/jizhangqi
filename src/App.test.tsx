import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { RecordItem } from './types'
import { addDays, addMonths, currentMonthKey, monthLabel, monthOf, todayStr } from './lib/date'
import { STORAGE_KEY, readLedger } from './lib/storage'

function makeRecord(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r1',
    type: 'expense',
    amount: 1250,
    category: 'food',
    date: todayStr(),
    note: '午饭',
    createdAt: Date.now(),
    ...overrides,
  }
}

function renderWith(records: RecordItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records }))
  return render(<App />)
}

function storedRecords(): RecordItem[] {
  const read = readLedger()
  return read.status === 'ok' ? read.records : []
}

describe('记账器 App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    document.body.classList.remove('sheet-open')
  })

  it('从空账本记一笔，金额、分类、日期都正确落库', async () => {
    const user = userEvent.setup()
    renderWith([])

    expect(screen.getByText('这个月还没有记录')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '记一笔' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeDisabled()

    await user.click(within(dialog).getByRole('button', { name: '1' }))
    await user.click(within(dialog).getByRole('button', { name: '2' }))
    await user.click(within(dialog).getByRole('button', { name: '小数点' }))
    await user.click(within(dialog).getByRole('button', { name: '5' }))
    await user.click(within(dialog).getByRole('button', { name: '昨天' }))
    expect(within(dialog).getByRole('button', { name: '保存' })).toBeEnabled()
    await user.click(within(dialog).getByRole('button', { name: '保存' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('已记一笔')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: '编辑 餐饮' })
    expect(within(row).getByText('-¥12.50')).toBeInTheDocument()

    const yesterday = addDays(todayStr(), -1)
    expect(storedRecords()).toHaveLength(1)
    expect(storedRecords()[0]).toMatchObject({
      type: 'expense',
      amount: 1250,
      category: 'food',
      date: yesterday,
    })
    expect(screen.getByText(monthLabel(monthOf(yesterday)))).toBeInTheDocument()
  })

  it('编辑记录时回填数据，保存后原地更新', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    await user.click(screen.getByRole('button', { name: '编辑 餐饮 午饭' }))
    const dialog = screen.getByRole('dialog', { name: '编辑 餐饮 记录' })

    const note = within(dialog).getByLabelText('备注')
    expect(note).toHaveValue('午饭')
    expect(within(dialog).getByText('12.5')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '删除一位' }))
    await user.click(within(dialog).getByRole('button', { name: '删除一位' }))
    await user.click(within(dialog).getByRole('button', { name: '3' }))
    await user.clear(note)
    await user.type(note, '晚饭')
    await user.click(within(dialog).getByRole('button', { name: '保存' }))

    expect(screen.getByText('已更新记录')).toBeInTheDocument()
    const row = screen.getByRole('button', { name: '编辑 餐饮 晚饭' })
    expect(within(row).getByText('-¥123')).toBeInTheDocument()
    expect(within(row).getByText('晚饭')).toBeInTheDocument()
    expect(storedRecords()[0]).toMatchObject({ id: 'r1', amount: 12300, note: '晚饭' })
  })

  it('删除需要二次确认，取消后记录保留', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    await user.click(screen.getByRole('button', { name: '编辑 餐饮 午饭' }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: '删除' }))

    let alert = screen.getByRole('alertdialog')
    expect(within(alert).getByText('删除这笔记录？')).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: '取消' }))
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(storedRecords()).toHaveLength(1)

    await user.click(within(dialog).getByRole('button', { name: '删除' }))
    alert = screen.getByRole('alertdialog')
    await user.click(within(alert).getByRole('button', { name: '删除' }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('这个月还没有记录')).toBeInTheDocument()
    expect(storedRecords()).toEqual([])
  })

  it('统计页按支出/收入切换并展示分类占比', async () => {
    const user = userEvent.setup()
    renderWith([
      makeRecord({ id: 'a', amount: 1250 }),
      makeRecord({ id: 'b', amount: 600, category: 'transport', note: '地铁' }),
      makeRecord({ id: 'c', type: 'income', amount: 1850000, category: 'salary', note: '工资' }),
    ])

    await user.click(screen.getByRole('button', { name: '统计' }))
    // 统计页是懒加载的独立 chunk，等它挂上来
    expect(await screen.findByText('分类占比')).toBeInTheDocument()
    expect(screen.getByText('¥12.50')).toBeInTheDocument()
    expect(screen.getByText('¥6')).toBeInTheDocument()
    expect(screen.getByText('2 笔')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '收入' }))
    expect(screen.getByText('工资')).toBeInTheDocument()
    expect(screen.getByText('¥18,500')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '支出' }))
    expect(screen.getByText('餐饮')).toBeInTheDocument()
    expect(screen.getByText('交通')).toBeInTheDocument()
  })

  it('可以切换月份，未来月份不可进入', async () => {
    const user = userEvent.setup()
    renderWith([])

    const current = currentMonthKey()
    expect(screen.getByText(monthLabel(current))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下个月' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: '上个月' }))
    expect(screen.getByText(monthLabel(addMonths(current, -1)))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '下个月' })).toBeEnabled()
    expect(screen.getByText('这个月还没有记录')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下个月' }))
    expect(screen.getByText(monthLabel(current))).toBeInTheDocument()
  })

  it('切换页面时回到顶部', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    const main = document.querySelector('.app-main') as HTMLElement
    main.scrollTop = 320
    await user.click(screen.getByRole('button', { name: '统计' }))

    expect(main.scrollTop).toBe(0)
  })

  it('更多菜单只有备份和清空两项，底部显示版本号', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    await user.click(screen.getByRole('button', { name: '更多操作' }))
    const menu = screen.getByRole('menu')

    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['导出/导入备份', '清空所有记录'])
    expect(within(menu).queryByRole('menuitem', { name: '重置示例账单' })).not.toBeInTheDocument()
    expect(within(menu).getByText(/^(v\d+\.\d+\.\d+|dev)$/)).toBeInTheDocument()
  })

  it('清空账本需要二次确认', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    await user.click(screen.getByRole('button', { name: '更多操作' }))
    await user.click(screen.getByRole('menuitem', { name: '清空所有记录' }))

    const alert = screen.getByRole('alertdialog')
    expect(within(alert).getByText('清空整个账本？')).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: '清空' }))

    expect(screen.getByText('这个月还没有记录')).toBeInTheDocument()
    expect(storedRecords()).toEqual([])
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('记账面板打开时锁住页面滚动，关闭后解锁', async () => {
    const user = userEvent.setup()
    renderWith([])

    await user.click(screen.getByRole('button', { name: '记一笔' }))
    expect(document.body).toHaveClass('sheet-open')

    await user.click(screen.getByRole('button', { name: '关闭记账面板' }))
    expect(document.body).not.toHaveClass('sheet-open')
  })
})