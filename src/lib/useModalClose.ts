import { useCallback, useEffect, useRef, useState } from 'react'

/** 与 styles.css 里 `.modal-backdrop.is-closing` 的 fade-out 时长保持一致 */
export const MODAL_EXIT_MS = 200

/**
 * 弹层的统一退场：先播 200ms 的收起动画，播完再通知父组件卸载。
 * 退场过程中重复调用会被忽略，避免连点触发两次 onClose。
 */
export function useModalClose(onClose: () => void, exitMs: number = MODAL_EXIT_MS) {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    }
  }, [])

  const close = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    timer.current = window.setTimeout(onClose, exitMs)
  }, [onClose, exitMs])

  return { closing, close }
}

/** 遮罩与卡片共用同一套退场 class，避免两处手写字符串走样 */
export function modalClass(base: string, closing: boolean): string {
  return closing ? `${base} is-closing` : base
}