import { useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Account } from '../types'
import { MAX_ACCOUNT_NAME } from '../lib/accounts'
import { modalClass, useModalClose } from '../lib/useModalClose'
import { Composer } from './Composer'
import { ModalLayer } from './ModalLayer'

interface AccountPanelProps {
  accounts: Account[]
  counts: Record<string, number>
  onClose: () => void
  onCreate: (name: string) => string | null
  onRename: (id: string, name: string) => string | null
  onRemove: (id: string) => void
}

type ComposerState = { mode: 'create' } | { mode: 'rename'; account: Account }

/** 账本管理：新增 / 改名 / 删除（删除会先转移记录，见 App 的二次确认） */
export function AccountPanel({
  accounts,
  counts,
  onClose,
  onCreate,
  onRename,
  onRemove,
}: AccountPanelProps) {
  const [composer, setComposer] = useState<ComposerState | null>(null)
  const { closing, close } = useModalClose(onClose)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // 输入卡自己处理 Esc，别把整个面板一起关掉
      if (composer) return
      event.preventDefault()
      close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close, composer])

  return (
    <ModalLayer>
      <div
        className={modalClass('account-card', closing)}
        role="dialog"
        aria-modal="true"
        aria-label="管理账本"
      >
        <header className="backup-header">
          <h2>管理账本</h2>
          <button type="button" className="backup-close" aria-label="关闭账本管理" onClick={close}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <p className="backup-hint">删除账本时，里面的记录会转到另一个账本，不会丢。</p>

        <ul className="account-list">
          {accounts.map((account) => (
            <li key={account.id} className="account-row">
              <span
                className="account-row-dot"
                style={{ background: account.color }}
                aria-hidden="true"
              />
              <span className="account-row-name">{account.name}</span>
              <span className="account-row-count">{counts[account.id] ?? 0} 笔</span>
              <button
                type="button"
                className="account-row-action"
                aria-label={`改名 ${account.name}`}
                onClick={() => setComposer({ mode: 'rename', account })}
              >
                改名
              </button>
              <button
                type="button"
                className="account-row-action danger"
                aria-label={`删除 ${account.name}`}
                disabled={accounts.length <= 1}
                onClick={() => onRemove(account.id)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="account-add-trigger"
          onClick={() => setComposer({ mode: 'create' })}
        >
          <Plus size={14} strokeWidth={2} aria-hidden="true" />
          新增账本
        </button>
      </div>

      {composer && (
        <Composer
          title={composer.mode === 'create' ? '新账本名' : `新名字 ${composer.account.name}`}
          initialValue={composer.mode === 'rename' ? composer.account.name : ''}
          placeholder={`新账本名（最多 ${MAX_ACCOUNT_NAME} 字）`}
          maxLength={MAX_ACCOUNT_NAME}
          confirmLabel={composer.mode === 'create' ? '新增' : '保存'}
          onSubmit={(value) =>
            composer.mode === 'create'
              ? onCreate(value)
              : onRename(composer.account.id, value)
          }
          onClose={() => setComposer(null)}
        />
      )}
    </ModalLayer>
  )
}