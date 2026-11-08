import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Account } from '../types'
import { MAX_ACCOUNT_NAME } from '../lib/accounts'
import { modalClass, useModalClose } from '../lib/useModalClose'

interface AccountPanelProps {
  accounts: Account[]
  counts: Record<string, number>
  onClose: () => void
  onCreate: (name: string) => string | null
  onRename: (id: string, name: string) => string | null
  onRemove: (id: string) => void
}

/** 账本管理：新增 / 改名 / 删除（删除会先转移记录，见 App 的二次确认） */
export function AccountPanel({
  accounts,
  counts,
  onClose,
  onCreate,
  onRename,
  onRemove,
}: AccountPanelProps) {
  const [draftName, setDraftName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { closing, close } = useModalClose(onClose)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [close])

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = onCreate(draftName)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setDraftName('')
  }

  function startRename(account: Account) {
    setEditingId(account.id)
    setEditingName(account.name)
    setError(null)
  }

  function handleRename(event: React.FormEvent<HTMLFormElement>, account: Account) {
    event.preventDefault()
    const message = onRename(account.id, editingName)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    setEditingId(null)
  }

  return (
    <div className={modalClass('modal-backdrop', closing)}>
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
              {editingId === account.id ? (
                <form
                  className="account-row-edit"
                  onSubmit={(event) => handleRename(event, account)}
                >
                  <input
                    aria-label={`新名字 ${account.name}`}
                    value={editingName}
                    maxLength={MAX_ACCOUNT_NAME}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button type="submit">保存</button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    取消
                  </button>
                </form>
              ) : (
                <>
                  <span className="account-row-name">{account.name}</span>
                  <span className="account-row-count">{counts[account.id] ?? 0} 笔</span>
                  <button
                    type="button"
                    className="account-row-action"
                    aria-label={`改名 ${account.name}`}
                    onClick={() => startRename(account)}
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
                </>
              )}
            </li>
          ))}
        </ul>

        <form className="account-add" onSubmit={handleCreate}>
          <input
            aria-label="新账本名"
            placeholder={`新账本名（最多 ${MAX_ACCOUNT_NAME} 字）`}
            value={draftName}
            maxLength={MAX_ACCOUNT_NAME}
            onChange={(event) => setDraftName(event.target.value)}
          />
          <button type="submit">新增</button>
        </form>

        {error && (
          <p className="backup-notice error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}