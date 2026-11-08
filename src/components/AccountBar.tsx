import type { CSSProperties } from 'react'
import type { Account, AccountFilter } from '../types'
import { ALL_ACCOUNTS } from '../lib/storage'

interface AccountBarProps {
  accounts: Account[]
  active: AccountFilter
  onChange: (filter: AccountFilter) => void
  onManage: () => void
}

/** 顶部账本切换条：全部 + 每个账本 + 管理入口 */
export function AccountBar({ accounts, active, onChange, onManage }: AccountBarProps) {
  return (
    <nav className="account-bar" aria-label="账本">
      <button
        type="button"
        className={`account-chip${active === ALL_ACCOUNTS ? ' active' : ''}`}
        aria-pressed={active === ALL_ACCOUNTS}
        onClick={() => onChange(ALL_ACCOUNTS)}
      >
        全部
      </button>
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          className={`account-chip${active === account.id ? ' active' : ''}`}
          aria-pressed={active === account.id}
          style={{ '--acc': account.color } as CSSProperties}
          onClick={() => onChange(account.id)}
        >
          <span className="account-dot" aria-hidden="true" />
          {account.name}
        </button>
      ))}
      <button type="button" className="account-manage" aria-label="管理账本" onClick={onManage}>
        ＋
      </button>
    </nav>
  )
}