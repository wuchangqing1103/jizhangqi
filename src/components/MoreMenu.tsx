import { RotateCcw, Trash2 } from 'lucide-react'

interface MoreMenuProps {
  onClose: () => void
  onReset: () => void
  onClear: () => void
}

export function MoreMenu({ onClose, onReset, onClear }: MoreMenuProps) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="more-menu" role="menu" aria-label="更多操作">
        <div className="menu-label">演示数据</div>
        <button type="button" role="menuitem" onClick={onReset}>
          <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
          重置示例账单
        </button>
        <button type="button" role="menuitem" className="danger" onClick={onClear}>
          <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
          清空所有记录
        </button>
        <p className="menu-footnote">数据只保存在本机浏览器，不会上传。</p>
      </div>
    </>
  )
}