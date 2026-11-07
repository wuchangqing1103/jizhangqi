import { Check } from 'lucide-react'

interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast" role="status">
      <Check size={14} strokeWidth={2.4} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}