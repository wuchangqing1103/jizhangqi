import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountBar } from './AccountBar'
import { ALL_ACCOUNTS, PRESET_ACCOUNTS } from '../lib/storage'

function setup(active = ALL_ACCOUNTS) {
  const onChange = vi.fn()
  const onManage = vi.fn()
  render(
    <AccountBar
      accounts={PRESET_ACCOUNTS}
      active={active}
      onChange={onChange}
      onManage={onManage}
    />,
  )
  return { onChange, onManage }
}

describe('AccountBar：账本切换条', () => {
  it('渲染「全部」、五个预置账本与管理入口，当前项 aria-pressed', () => {
    setup()
    const bar = screen.getByRole('navigation', { name: '账本' })

    expect(within(bar).getByRole('button', { name: '全部' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    for (const account of PRESET_ACCOUNTS) {
      expect(within(bar).getByRole('button', { name: account.name })).toHaveAttribute(
        'aria-pressed',
        'false',
      )
    }
    expect(within(bar).getByRole('button', { name: '管理账本' })).toBeInTheDocument()
  })

  it('点某个账本或「全部」都会回调，选中态跟着 active 走', async () => {
    const user = userEvent.setup()
    const { onChange } = setup('acc-wechat')

    expect(screen.getByRole('button', { name: '微信' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: '现金' }))
    expect(onChange).toHaveBeenCalledWith('acc-cash')

    await user.click(screen.getByRole('button', { name: '全部' }))
    expect(onChange).toHaveBeenLastCalledWith(ALL_ACCOUNTS)
  })

  it('点＋打开管理面板', async () => {
    const user = userEvent.setup()
    const { onManage } = setup()

    await user.click(screen.getByRole('button', { name: '管理账本' }))
    expect(onManage).toHaveBeenCalledTimes(1)
  })
})