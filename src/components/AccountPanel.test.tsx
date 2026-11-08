import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountPanel } from './AccountPanel'
import { PRESET_ACCOUNTS } from '../lib/storage'

function setup(overrides: Partial<Parameters<typeof AccountPanel>[0]> = {}) {
  const props = {
    accounts: PRESET_ACCOUNTS,
    counts: { 'acc-cash': 2, 'acc-wechat': 1 },
    onClose: vi.fn(),
    onCreate: vi.fn(() => null as string | null),
    onRename: vi.fn(() => null as string | null),
    onRemove: vi.fn(),
    ...overrides,
  }
  render(<AccountPanel {...props} />)
  return props
}

describe('AccountPanel：账本管理', () => {
  it('列出每个账本、各自的记录数和操作按钮', () => {
    setup()
    const panel = screen.getByRole('dialog', { name: '管理账本' })

    expect(within(panel).getByText('2 笔')).toBeInTheDocument()
    for (const account of PRESET_ACCOUNTS) {
      expect(within(panel).getByRole('button', { name: `改名 ${account.name}` })).toBeInTheDocument()
      expect(within(panel).getByRole('button', { name: `删除 ${account.name}` })).toBeEnabled()
    }
  })

  it('新增账本调用 onCreate，成功后会清空输入', async () => {
    const user = userEvent.setup()
    const { onCreate } = setup()

    const input = screen.getByLabelText('新账本名')
    await user.type(input, '旅行')
    await user.click(screen.getByRole('button', { name: '新增' }))

    expect(onCreate).toHaveBeenCalledWith('旅行')
    expect(input).toHaveValue('')
  })

  it('新增失败时显示错误文案，输入保留', async () => {
    const user = userEvent.setup()
    setup({ onCreate: vi.fn(() => '已经有同名账本了') })

    const input = screen.getByLabelText('新账本名')
    await user.type(input, '现金')
    await user.click(screen.getByRole('button', { name: '新增' }))

    expect(screen.getByRole('alert')).toHaveTextContent('已经有同名账本了')
    expect(input).toHaveValue('现金')
  })

  it('改名进入内联编辑，保存后调用 onRename', async () => {
    const user = userEvent.setup()
    const { onRename } = setup()

    await user.click(screen.getByRole('button', { name: '改名 现金' }))
    const input = screen.getByLabelText('新名字 现金')
    expect(input).toHaveValue('现金')

    await user.clear(input)
    await user.type(input, '零钱')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(onRename).toHaveBeenCalledWith('acc-cash', '零钱')
  })

  it('删除按钮把 id 交给上层（转移记录与二次确认由 App 负责）', async () => {
    const user = userEvent.setup()
    const { onRemove } = setup()

    await user.click(screen.getByRole('button', { name: '删除 微信' }))
    expect(onRemove).toHaveBeenCalledWith('acc-wechat')
  })

  it('只剩一个账本时不允许删除', () => {
    setup({ accounts: [PRESET_ACCOUNTS[0]], counts: {} })

    expect(screen.getByRole('button', { name: `删除 ${PRESET_ACCOUNTS[0].name}` })).toBeDisabled()
  })

  it('关闭按钮走退场，200ms 后才通知关闭，连点只关一次', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    await user.click(screen.getByRole('button', { name: '关闭账本管理' }))
    expect(document.querySelector('.modal-backdrop')).toHaveClass('is-closing')
    expect(onClose).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '关闭账本管理' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('Esc 也会关闭，点侵入背景的空白不会', async () => {
    const user = userEvent.setup()
    const { onClose } = setup()

    fireEvent.click(document.querySelector('.modal-backdrop') as HTMLElement)
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })
})