import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { modalClass, useModalClose } from '../lib/useModalClose'

interface ComposerProps {
  /** 只作为卡片与输入框的无障碍名，不再显示在界面上 */
  title: string
  initialValue?: string
  placeholder?: string
  multiline?: boolean
  maxLength?: number
  confirmLabel?: string
  /** 返回错误文案则不收起并显示；返回 null 表示成功，卡片自动退场 */
  onSubmit: (value: string) => string | null
  onClose: () => void
}

/**
 * 键盘时代的输入卡：不放在面板内部，而是浮在屏幕上半部，
 * 这样 iOS 弹键盘时既不会把整页顶起来，也不会盖住正在输入的地方。
 */
export function Composer({
  title,
  initialValue = '',
  placeholder,
  multiline = false,
  maxLength,
  confirmLabel = '完成',
  onSubmit,
  onClose,
}: ComposerProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const { closing, close } = useModalClose(onClose)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    // 焦点必须在点击手势的同一个任务里落下，iOS 才会当场把键盘推起来；
    // 放到 setTimeout 里再 focus，键盘不会弹，用户还得再点一次。
    inputRef.current?.focus()
  }, [])

  function handleSubmit() {
    const message = onSubmit(value)
    if (message) {
      setError(message)
      return
    }
    close()
  }

  const fieldProps = {
    className: 'composer-field',
    value,
    placeholder,
    maxLength,
    autoFocus: true,
    'aria-label': title,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(event.target.value)
      if (error) setError(null)
    },
  }

  return createPortal(
    <div className={modalClass('composer-layer', closing)}>
      <div
        className={modalClass('composer-card', closing)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {multiline ? (
          <textarea
            {...fieldProps}
            ref={(node) => {
              inputRef.current = node
            }}
            rows={2}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                close()
              }
            }}
          />
        ) : (
          <input
            {...fieldProps}
            ref={(node) => {
              inputRef.current = node
            }}
            type="text"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                handleSubmit()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                close()
              }
            }}
          />
        )}

        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}

        <div className="composer-actions">
          <button type="button" className="composer-action" onClick={close}>
            取消
          </button>
          <button type="button" className="composer-action primary" onClick={handleSubmit}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}