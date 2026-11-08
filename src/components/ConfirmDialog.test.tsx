import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

function setup() {
  const onCancel = vi.fn()
  const onConfirm = vi.fn()
  render(
    <ConfirmDialog
      title="删除这笔记录？"
      message="删除后不可恢复。"
      confirmLabel="删除"
      onCancel={onCancel}
      onConfirm={onConfirm}
    />,
  )
  return { onCancel, onConfirm }
}

describe('ConfirmDialog', () => {
  it('渲染标题、说明与两个按钮', () => {
    setup()

    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveAccessibleName('删除这笔记录？')
    expect(screen.getByText('删除后不可恢复。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('点遮罩空白不关闭，点取消先播退场再通知父组件', async () => {
    const user = userEvent.setup()
    const { onCancel, onConfirm } = setup()

    fireEvent.click(document.querySelector('.modal-layer') as HTMLElement)
    expect(onCancel).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.getByRole('alertdialog')).toHaveClass('is-closing')
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1))
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('确认按钮立即回调，不等退场', async () => {
    const user = userEvent.setup()
    const { onConfirm } = setup()

    await user.click(screen.getByRole('button', { name: '删除' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('弹层挂到 body、遮罩同一帧出现不掉帧（CSS 契约）', () => {
    const css = readFileSync('src/styles.css', 'utf8')

    // 全屏层不能有任何毛玻璃或透明度过渡，否则 iOS 重合成时顶部安全区会慢一帧
    expect(css).not.toMatch(/\.modal-(scrim|layer)\s*\{[^}]*backdrop-filter/)
    expect(css).not.toMatch(/\.modal-scrim\s*\{[^}]*transition:\s*opacity/)
    expect(css).toMatch(/\.modal-scrim\s*\{[^}]*visibility:\s*hidden;[^}]*pointer-events:\s*none/)
    expect(css).toMatch(/\.modal-scrim\.is-open\s*\{[^}]*visibility:\s*visible;[^}]*pointer-events:\s*auto/)
    expect(css).toMatch(/\.modal-layer\s*\{[^}]*position:\s*fixed;[^}]*pointer-events:\s*none/)
    expect(css).toMatch(
      /\.confirm-card\s*\{[^}]*animation:\s*dialog-in 0\.34s cubic-bezier\(0\.32, 0\.72, 0, 1\)/,
    )
    expect(css).toMatch(/@keyframes dialog-in\s*\{[^}]*scale\(0\.92\) translateY\(24px\)/)
    expect(css).toMatch(/@keyframes dialog-out\s*\{[\s\S]*?scale\(0\.96\) translateY\(8px\)/)
    expect(css).toMatch(/body\.modal-open\s*\{[^}]*overflow:\s*hidden/)

    // 记账面板的遮罩同样不能有毛玻璃与淡入；根部背景要和 body 同色，首帧补画才不会发白
    expect(css).not.toMatch(/\.sheet-backdrop\s*\{[^}]*backdrop-filter/)
    expect(css).toMatch(/html\s*\{[^}]*background-color:\s*var\(--bg\)/)
  })
})