import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import type { Account, RecordItem } from './types'
import { addDays, addMonths, currentMonthKey, monthLabel, monthOf, todayStr } from './lib/date'
import {
  ALL_ACCOUNTS,
  DEFAULT_ACCOUNT_ID,
  PRESET_ACCOUNTS,
  STORAGE_KEY,
  readLedger,
} from './lib/storage'

const CASH = 'acc-cash'
const WECHAT = 'acc-wechat'

function makeRecord(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r1',
    type: 'expense',
    amount: 1250,
    category: 'food',
    date: todayStr(),
    note: '午饭',
    createdAt: Date.now(),
    accountId: CASH,
    ...overrides,
  }
}

function writeLedger(
  records: RecordItem[],
  accounts: Account[] = PRESET_ACCOUNTS,
  activeAccountId = ALL_ACCOUNTS,
) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 2, accounts, activeAccountId, records }),
  )
}

function renderWith(records: RecordItem[]) {
  writeLedger(records)
  return render(<App />)
}

function storedRecords(): RecordItem[] {
  const read = readLedger()
  return read.status === 'ok' ? read.ledger.records : []
}

describe('记账器 App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    document.body.classList.remove('sheet-open')
    document.body.classList.remove('modal-open')
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
      accountId: DEFAULT_ACCOUNT_ID,
    })
    expect(screen.getByText(monthLabel(monthOf(yesterday)))).toBeInTheDocument()
  })

  it('编辑记录时回填数据，保存后原地更新', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    await user.click(screen.getByRole('button', { name: '编辑 餐饮 午饭' }))
    const dialog = screen.getByRole('dialog', { name: '编辑 餐饮 记录' })

    const note = within(dialog).getByRole('button', { name: '备注' })
    expect(note).toHaveTextContent('午饭')
    expect(within(dialog).getByText('12.5')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '删除一位' }))
    await user.click(within(dialog).getByRole('button', { name: '删除一位' }))
    await user.click(within(dialog).getByRole('button', { name: '3' }))

    // 备注在输入卡里改，键盘弹起时面板不动
    await user.click(note)
    const card = screen.getByRole('dialog', { name: '备注' })
    const field = within(card).getByLabelText('备注')
    await user.clear(field)
    await user.type(field, '晚饭')
    await user.click(within(card).getByRole('button', { name: '完成' }))

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
    // 取消同样先播 200ms 退场，播完才卸载
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
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

  it('更多菜单只有备份和清空两项，底部显示版本号与构建时间', async () => {
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
    // 本轮带构建时间，用来确认手机上跑的是不是新包
    expect(
      within(menu).getByText(
        /^(v\d+\.\d+\.\d+ · \d{2}-\d{2} \d{2}:\d{2}|v\d+\.\d+\.\d+|dev)$/,
      ),
    ).toBeInTheDocument()
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
    // 退场动画 240ms 后才卸载，滚动锁随之解除
    await waitFor(() => expect(document.body).not.toHaveClass('sheet-open'))
  })

  it('左滑删除：二次确认后记录消失、提示出现在固定位置', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord()])

    const row = screen.getByRole('button', { name: '编辑 餐饮 午饭' })
    fireEvent.pointerDown(row, { pointerId: 1, pointerType: 'touch', clientX: 240, clientY: 300 })
    fireEvent.pointerMove(row, { pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 300 })
    fireEvent.pointerUp(row, { pointerId: 1, pointerType: 'touch', clientX: 150, clientY: 300 })

    await user.click(screen.getByRole('button', { name: '删除 餐饮 午饭' }))
    const alert = screen.getByRole('alertdialog')
    expect(within(alert).getByText('删除这笔记录？')).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: '删除' }))

    expect(screen.getByText('已删除记录').closest('.toast')).not.toBeNull()
    expect(screen.getByText('这个月还没有记录')).toBeInTheDocument()
    expect(storedRecords()).toEqual([])
  })

  it('切换账本只显示该账本的记录，「全部」合并显示', async () => {
    const user = userEvent.setup()
    renderWith([
      makeRecord({ id: 'r1', note: '午饭', accountId: CASH }),
      makeRecord({ id: 'r2', note: '打车', accountId: WECHAT }),
    ])

    expect(screen.getByRole('button', { name: '编辑 餐饮 午饭' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑 餐饮 打车' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '微信' }))
    expect(screen.getByRole('button', { name: '编辑 餐饮 打车' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '编辑 餐饮 午饭' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '全部' }))
    expect(screen.getByRole('button', { name: '编辑 餐饮 午饭' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '编辑 餐饮 打车' })).toBeInTheDocument()
  })

  it('新增记录归属当前选中的账本', async () => {
    const user = userEvent.setup()
    renderWith([])

    await user.click(screen.getByRole('button', { name: '微信' }))
    await user.click(screen.getByRole('button', { name: '记一笔' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('记到哪个账本')).toHaveValue(WECHAT)

    await user.click(within(dialog).getByRole('button', { name: '9' }))
    await user.click(within(dialog).getByRole('button', { name: '保存' }))

    expect(storedRecords()[0]).toMatchObject({ accountId: WECHAT })
  })

  it('删除账本要二次确认，记录会转移到另一个账本', async () => {
    const user = userEvent.setup()
    renderWith([makeRecord({ id: 'r1' }), makeRecord({ id: 'r2' })])

    await user.click(screen.getByRole('button', { name: '管理账本' }))
    await user.click(screen.getByRole('button', { name: '删除 现金' }))

    const alert = screen.getByRole('alertdialog')
    expect(within(alert).getByText('2 条记录会转到「微信」，记录不会丢失。')).toBeInTheDocument()
    await user.click(within(alert).getByRole('button', { name: '删除账本' }))

    expect(storedRecords()).toHaveLength(2)
    expect(storedRecords().every((item) => item.accountId === WECHAT)).toBe(true)
    expect(screen.queryByRole('button', { name: '现金' })).not.toBeInTheDocument()
  })

  it('管理账本可以新增与改名，重名会被拦下', async () => {
    const user = userEvent.setup()
    renderWith([])

    await user.click(screen.getByRole('button', { name: '管理账本' }))
    const panel = screen.getByRole('dialog', { name: '管理账本' })

    await user.click(screen.getByRole('button', { name: '新增账本' }))
    let card = screen.getByRole('dialog', { name: '新账本名' })
    await user.type(within(card).getByLabelText('新账本名'), '旅行')
    await user.click(within(card).getByRole('button', { name: '新增' }))
    await waitFor(() => expect(screen.getByRole('button', { name: '旅行' })).toBeInTheDocument())
    // 等上一张输入卡退场完再打开下一张
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '新账本名' })).not.toBeInTheDocument(),
    )

    await user.click(screen.getByRole('button', { name: '新增账本' }))
    card = screen.getByRole('dialog', { name: '新账本名' })
    await user.type(within(card).getByLabelText('新账本名'), '旅行')
    await user.click(within(card).getByRole('button', { name: '新增' }))
    expect(within(card).getByRole('alert')).toHaveTextContent('已经有同名账本了')
    await user.click(within(card).getByRole('button', { name: '取消' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '新账本名' })).not.toBeInTheDocument(),
    )

    await user.click(within(panel).getByRole('button', { name: '改名 旅行' }))
    const renameCard = screen.getByRole('dialog', { name: '新名字 旅行' })
    const input = within(renameCard).getByLabelText('新名字 旅行')
    await user.clear(input)
    await user.type(input, '出行')
    await user.click(within(renameCard).getByRole('button', { name: '保存' }))

    await waitFor(() => expect(screen.getByRole('button', { name: '出行' })).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: '旅行' })).not.toBeInTheDocument()
  })

  it('弹层打开时锁住背景，点空白不会关闭，只有 × 才关闭', async () => {
    const user = userEvent.setup()
    renderWith([])

    await user.click(screen.getByRole('button', { name: '管理账本' }))
    expect(screen.getByRole('dialog', { name: '管理账本' })).toBeInTheDocument()
    expect(document.body).toHaveClass('modal-open')

    fireEvent.click(document.querySelector('.modal-scrim') as HTMLElement)
    expect(screen.getByRole('dialog', { name: '管理账本' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '关闭账本管理' }))
    // 退场动画 200ms 之后才卸载，背景锁也同时解除
    await waitFor(() => expect(document.body).not.toHaveClass('modal-open'))
    expect(screen.queryByRole('dialog', { name: '管理账本' })).not.toBeInTheDocument()
  })

  it('提示固定在＋号上方（读 styles.css 的 CSS 契约）', () => {
    const css = readFileSync('src/styles.css', 'utf8')
    expect(css).toMatch(/\.toast\s*\{[^}]*position:\s*fixed/)
    expect(css).toMatch(
      /\.toast\s*\{[^}]*bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\)/,
    )
  })
})