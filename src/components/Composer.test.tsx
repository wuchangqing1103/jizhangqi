import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Composer } from './Composer'

describe('Composer：键盘输入卡', () => {
  it('打开后自动聚焦、回车提交、成功后收起', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => null)
    const onClose = vi.fn()
    render(<Composer title="备注" onSubmit={onSubmit} onClose={onClose} />)

    const card = screen.getByRole('dialog', { name: '备注' })
    const field = within(card).getByLabelText('备注')

    // 焦点在挂载的这一帧就落下，不能等定时器（iOS 只有手势同一任务里 focus 才弹键盘）
    expect(field).toHaveFocus()

    await user.type(field, '打车{Enter}')
    expect(onSubmit).toHaveBeenCalledWith('打车')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('卡片上不显示标题、不显示占位文字，按钮排在输入框下面', () => {
    render(<Composer title="备注" onSubmit={() => null} onClose={vi.fn()} />)

    const card = screen.getByRole('dialog', { name: '备注' })
    expect(within(card).queryByText('备注')).not.toBeInTheDocument()
    expect(within(card).getByLabelText('备注')).not.toHaveAttribute('placeholder')

    const field = within(card).getByLabelText('备注')
    const actions = card.querySelector('.composer-actions')
    expect(actions).not.toBeNull()
    // 按钮在输入框之后（DOM 顺序决定视觉顺序）
    expect(field.compareDocumentPosition(actions as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(actions as HTMLElement).getByRole('button', { name: '取消' })).toBeInTheDocument()
    expect(within(actions as HTMLElement).getByRole('button', { name: '完成' })).toBeInTheDocument()
  })

  it('提交报错时不收起，错误文案可见，改动后自动清掉', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn((value: string) => (value === '现金' ? '已经有同名账本了' : null))
    const onClose = vi.fn()
    render(<Composer title="新账本名" initialValue="" onSubmit={onSubmit} onClose={onClose} />)

    const card = screen.getByRole('dialog', { name: '新账本名' })
    const field = within(card).getByLabelText('新账本名')

    await user.type(field, '现金')
    await user.click(within(card).getByRole('button', { name: '完成' }))

    expect(within(card).getByRole('alert')).toHaveTextContent('已经有同名账本了')
    expect(onClose).not.toHaveBeenCalled()

    await user.type(field, '夹')
    expect(within(card).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('取消只收起、不提交', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => null)
    const onClose = vi.fn()
    render(<Composer title="备注" initialValue="旧值" onSubmit={onSubmit} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: '取消' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('初始值回填，多行输入用 textarea', () => {
    render(<Composer title="备注" initialValue="午饭" multiline onSubmit={() => null} onClose={vi.fn()} />)

    const card = screen.getByRole('dialog', { name: '备注' })
    const field = within(card).getByLabelText('备注')
    expect(field).toHaveValue('午饭')
    expect(field.tagName).toBe('TEXTAREA')
  })
})