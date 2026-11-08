import { Trash2 } from 'lucide-react'
import { modalClass, useModalClose } from '../lib/useModalClose'
import { ModalLayer } from './ModalLayer'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const { closing, close } = useModalClose(onCancel)

  return (
    <ModalLayer>
      <div
        className={modalClass('confirm-card', closing)}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
      >
        <div className="confirm-icon">
          <Trash2 size={20} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h3 id="confirm-title">{title}</h3>
        <p id="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button type="button" onClick={close}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalLayer>
  )
}