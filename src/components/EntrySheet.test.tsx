import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EntrySheet } from './EntrySheet'
import { DEFAULT_ACCOUNT_ID, PRESET_ACCOUNTS } from '../lib/storage'

const styles = readFileSync('src/styles.css', 'utf8')

function renderSheet() {
  const onClose = vi.fn()
  const onSubmit = vi.fn()
  const onRequestDelete = vi.fn()
  render(
    <EntrySheet
      record={null}
      accounts={PRESET_ACCOUNTS}
      defaultAccountId={DEFAULT_ACCOUNT_ID}
      onClose={onClose}
      onSubmit={onSubmit}
      onRequestDelete={onRequestDelete}
    />,
  )
  const sheet = screen.getByRole('dialog', { name: '记一笔' })
  return { sheet, onClose, onSubmit, onRequestDelete }
}

describe('记账面板：结构、分类与聚焦', () => {
  it('保存键在固定 footer 里，footer 与 body 都是面板的直接子元素', () => {
    const { sheet } = renderSheet()
    const footer = sheet.querySelector('.sheet-footer') as HTMLElement
    const body = sheet.querySelector('.sheet-body') as HTMLElement

    expect(footer.parentElement).toBe(sheet)
    expect(body.parentElement).toBe(sheet)
    expect(within(footer).getByRole('button', { name: '保存' })).toBeInTheDocument()
    // body 在 footer 之前，滚动只发生在中间区
    expect(body.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('支出 9 个分类全部露出，收入 5 个，没有「更多」', async () => {
    const user = userEvent.setup()
    renderSheet()

    const expenseGroup = screen.getByRole('group', { name: '选择分类' })
    expect(within(expenseGroup).getAllByRole('button')).toHaveLength(9)
    expect(within(expenseGroup).queryByRole('button', { name: /更多/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '收入' }))
    const incomeGroup = screen.getByRole('group', { name: '选择分类' })
    expect(within(incomeGroup).getAllByRole('button')).toHaveLength(5)
  })

  it('备注不在面板里直接输入：点开输入卡、完成后写回并随记录保存', async () => {
    const user = userEvent.setup()
    const { sheet, onSubmit } = renderSheet()

    const trigger = screen.getByRole('button', { name: '备注' })
    expect(trigger).toHaveTextContent('添加备注（选填）')

    await user.click(trigger)
    const card = screen.getByRole('dialog', { name: '备注' })
    await user.type(within(card).getByLabelText('备注'), '和同事')
    await user.click(within(card).getByRole('button', { name: '完成' }))

    await waitFor(() => expect(trigger).toHaveTextContent('和同事'))

    await user.click(screen.getByRole('button', { name: '9' }))
    await user.click(within(sheet).getByRole('button', { name: '保存' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 900, note: '和同事' }))
  })

  it('「记到」默认选中传入账本，切换后保存带上 accountId', async () => {
    const user = userEvent.setup()
    const { onSubmit } = renderSheet()

    const pick = screen.getByLabelText('记到哪个账本')
    expect(pick).toHaveValue(DEFAULT_ACCOUNT_ID)

    await user.click(screen.getByRole('button', { name: '9' }))
    await user.selectOptions(pick, 'acc-wechat')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 900, accountId: 'acc-wechat' }),
    )
  })

  it('CSS 契约：三段式 flex、分类 5 列、键盘/保存键压矮、进出场单段缓动', () => {
    expect(styles).toMatch(/\.entry-sheet\s*\{[^}]*display:\s*flex/)
    expect(styles).toMatch(/\.entry-sheet\s*\{[^}]*max-height:\s*92dvh/)
    expect(styles).toMatch(/\.entry-sheet\s*\{[^}]*overflow:\s*hidden/)
    expect(styles).toMatch(/\.sheet-body\s*\{[^}]*min-height:\s*0/)
    expect(styles).toMatch(/\.category-grid\s*\{[^}]*repeat\(5,\s*1fr\)/)
    expect(styles).toMatch(/\.category-option \.cat-icon\s*\{[^}]*width:\s*26px/)
    expect(styles).toMatch(/\.key\s*\{[^}]*height:\s*40px/)
    expect(styles).toMatch(/\.save-button\s*\{[^}]*height:\s*44px/)

    // 进场：一条 iOS 式曲线跑完整个行程，不再是「30% 冲 90% 再慢慢爬」
    expect(styles).toMatch(/animation:\s*sheet-up 0\.52s cubic-bezier\(0\.32, 0\.72, 0, 1\) both/)
    expect(styles).toMatch(/@keyframes sheet-up\s*\{[^}]*from\s*\{[^}]*translate\(-50%,\s*100%\)/)
    expect(styles).not.toMatch(/30%\s*\{[^}]*10\.4%/)

    // 退场：面板 0.24s 滑下去，遮罩不淡出、跟着一起卸载（淡出会让顶部安全区闪）
    expect(styles).toMatch(/\.entry-sheet\.is-closing\s*\{[^}]*animation:\s*sheet-down 0\.24s/)
    expect(styles).not.toMatch(/\.sheet-backdrop\.is-closing\s*\{[^}]*fade-out/)
    // 进场时遮罩不做淡入、不带毛玻璃：全屏层一参与合成，iOS 顶部安全区就慢一帧
    expect(styles).not.toMatch(/\.sheet-backdrop\s*\{[^}]*fade-in/)
    expect(styles).not.toMatch(/\.sheet-backdrop\s*\{[^}]*backdrop-filter/)
    // 安全区那条也不许被盖住，否则关闭时同样闪
    expect(styles).toMatch(/\.sheet-backdrop\s*\{[^}]*top:\s*env\(safe-area-inset-top/)
  })

  it('关闭时先播退场动画，240ms 后才通知父组件卸载，重复点只关一次', () => {
    vi.useFakeTimers()
    try {
      const { sheet, onClose } = renderSheet()

      fireEvent.click(screen.getByRole('button', { name: '关闭记账面板' }))
      expect(onClose).not.toHaveBeenCalled()
      expect(sheet).toHaveClass('is-closing')
      expect(document.querySelector('.sheet-backdrop')).toHaveClass('is-closing')

      fireEvent.click(screen.getByRole('button', { name: '关闭记账面板' }))
      act(() => {
        vi.advanceTimersByTime(240)
      })

      expect(onClose).toHaveBeenCalledTimes(1)
      expect(sheet).toHaveClass('is-closing')
    } finally {
      vi.useRealTimers()
    }
  })
})