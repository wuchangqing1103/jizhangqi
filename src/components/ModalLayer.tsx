import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/**
 * 弹层统一挂到 body：
 * 1. 躲开 .app-frame 的 overflow 裁剪，宽屏下也不会被 448px 的容器挤小；
 * 2. 每次打开不再在 .app-frame 内部新建合成层，减少 iOS 首帧重绘（顶部那条会闪）。
 */
export function ModalLayer({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null
  return createPortal(<div className="modal-layer">{children}</div>, document.body)
}