import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RecordItem } from '../types'
import { currentMonthKey, todayStr } from '../lib/date'
import { BillPage } from './BillPage'

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

function renderBillPage(records: RecordItem[] = [makeRecord()]) {
  const onEdit = vi.fn()
  const onAdd = vi.fn()
  const onRequestDelete = vi.fn()
  render(
    <BillPage
      month={currentMonthKey()}
      records={records}
      onEdit={onEdit}
      onAdd={onAdd}
      onRequestDelete={onRequestDelete}
    />,
  )
  const row = screen.getByRole('button', { name: '编辑 餐饮 午饭' })
  const swipe = row.parentElement as HTMLElement
  return { row, swipe, onEdit, onAdd, onRequestDelete }
}

const touch = { pointerId: 1, pointerType: 'touch', button: 0 }

describe('账单页：左滑与长按删除', () => {
  it('左滑超过 40px 后抬手，行吸附打开 84px，删除按钮可用', () => {
    const { row, swipe, onEdit, onRequestDelete } = renderBillPage()

    fireEvent.pointerDown(row, { ...touch, clientX: 240, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 170, clientY: 300 })
    // 跟手阶段按位移实时平移
    expect(swipe.style.transform).toBe('translateX(-70px)')

    fireEvent.pointerUp(row, { ...touch, clientX: 170, clientY: 300 })
    expect(swipe.style.transform).toBe('translateX(-84px)')

    expect(onEdit).not.toHaveBeenCalled()
    expect(onRequestDelete).not.toHaveBeenCalled()
  })

  it('左滑不足阈值回弹，点击行仍打开编辑', async () => {
    const user = userEvent.setup()
    const { row, swipe, onEdit } = renderBillPage()

    fireEvent.pointerDown(row, { ...touch, clientX: 200, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 180, clientY: 300 })
    fireEvent.pointerUp(row, { ...touch, clientX: 180, clientY: 300 })
    expect(swipe.style.transform).toBe('translateX(0px)')

    await user.click(row)
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('已打开的行再次点击只收起，不打开编辑', async () => {
    const user = userEvent.setup()
    const { row, swipe, onEdit } = renderBillPage()

    fireEvent.pointerDown(row, { ...touch, clientX: 240, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 150, clientY: 300 })
    fireEvent.pointerUp(row, { ...touch, clientX: 150, clientY: 300 })
    expect(swipe.style.transform).toBe('translateX(-84px)')

    await user.click(row)
    expect(swipe.style.transform).toBe('translateX(0px)')
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('已打开的行往右拖会跟手回移，越过阈值后收起', () => {
    const { row, swipe } = renderBillPage()

    fireEvent.pointerDown(row, { ...touch, clientX: 240, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 150, clientY: 300 })
    fireEvent.pointerUp(row, { ...touch, clientX: 150, clientY: 300 })
    expect(swipe.style.transform).toBe('translateX(-84px)')

    fireEvent.pointerDown(row, { ...touch, clientX: 100, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 150, clientY: 300 })
    // 从 -84 接着往右拖 50px，跟手停在 -34px，不能突然跳回 0
    expect(swipe.style.transform).toBe('translateX(-34px)')
    fireEvent.pointerUp(row, { ...touch, clientX: 150, clientY: 300 })
    expect(swipe.style.transform).toBe('translateX(0px)')
  })

  it('点删除按钮请求二次确认，不直接删除也不打开编辑', async () => {
    const user = userEvent.setup()
    const { onEdit, onRequestDelete } = renderBillPage()

    await user.click(screen.getByRole('button', { name: '删除 餐饮 午饭' }))
    expect(onRequestDelete).toHaveBeenCalledTimes(1)
    expect(onRequestDelete.mock.calls[0][0]).toMatchObject({ id: 'r1', note: '午饭' })
    expect(onEdit).not.toHaveBeenCalled()
  })

  it('长按 500ms 请求确认框，且抬手后的 click 不会再打开编辑', () => {
    vi.useFakeTimers()
    try {
      const { row, onEdit, onRequestDelete } = renderBillPage()

      fireEvent.pointerDown(row, { ...touch, clientX: 220, clientY: 300 })
      act(() => {
        vi.advanceTimersByTime(520)
      })
      expect(onRequestDelete).toHaveBeenCalledTimes(1)

      fireEvent.pointerUp(row, { ...touch, clientX: 220, clientY: 300 })
      fireEvent.click(row)
      expect(onEdit).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('纵向拖动交给页面滚动，既不打开删除也不进编辑', () => {
    const { row, swipe, onEdit, onRequestDelete } = renderBillPage()

    fireEvent.pointerDown(row, { ...touch, clientX: 200, clientY: 200 })
    fireEvent.pointerMove(row, { ...touch, clientX: 203, clientY: 260 })
    fireEvent.pointerUp(row, { ...touch, clientX: 203, clientY: 260 })
    fireEvent.click(row)

    expect(swipe.style.transform).toBe('translateX(0px)')
    expect(onEdit).not.toHaveBeenCalled()
    expect(onRequestDelete).not.toHaveBeenCalled()
  })

  it('删除按钮是垃圾桶图标 + 删除文案，图标随滑动淡入淡出', () => {
    const { row } = renderBillPage()
    const button = screen.getByRole('button', { name: '删除 餐饮 午饭' })
    const inner = button.querySelector('.record-delete-inner') as HTMLElement

    expect(inner.querySelector('svg')).not.toBeNull()
    expect(inner.textContent).toBe('删除')
    // 收起时完全透明，并且不进 Tab 序列
    expect(inner.style.opacity).toBe('0')
    expect(button).toHaveAttribute('tabindex', '-1')

    fireEvent.pointerDown(row, { ...touch, clientX: 240, clientY: 300 })
    fireEvent.pointerMove(row, { ...touch, clientX: 212, clientY: 300 })
    // 28px / 56px → 淡入一半
    expect(Number(inner.style.opacity)).toBeCloseTo(0.5, 5)

    fireEvent.pointerMove(row, { ...touch, clientX: 150, clientY: 300 })
    expect(inner.style.opacity).toBe('1')

    fireEvent.pointerUp(row, { ...touch, clientX: 150, clientY: 300 })
    expect(inner.style.opacity).toBe('1')
    expect(button).toHaveAttribute('tabindex', '0')
  })

  it('删掉两行冗余小字：不再有「点条目可编辑」和每日收支小计', () => {
    renderBillPage()

    expect(screen.getByText('账单明细')).toBeInTheDocument()
    expect(screen.queryByText('点条目可编辑')).not.toBeInTheDocument()
    expect(screen.queryByText('还没有记录')).not.toBeInTheDocument()
    expect(document.querySelector('.day-totals')).toBeNull()
    expect(screen.queryByText(/^支出 ¥/)).not.toBeInTheDocument()
    expect(screen.queryByText(/^收入 ¥/)).not.toBeInTheDocument()
  })
})