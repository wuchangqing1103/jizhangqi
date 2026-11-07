import { Download, Trash2 } from 'lucide-react'
import { buildLabel } from '../lib/build-info'

interface MoreMenuProps {
  onClose: () => void
  onBackup: () => void
  onClear: () => void
}

export function MoreMenu({ onClose, onBackup, onClear }: MoreMenuProps) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="more-menu" role="menu" aria-label="更多操作">
        <button type="button" role="menuitem" onClick={onBackup}>
          <Download size={15} strokeWidth={1.8} aria-hidden="true" />
          导出/导入备份
        </button>
        <button type="button" role="menuitem" className="danger" onClick={onClear}>
          <Trash2 size={15} strokeWidth={1.8} aria-hidden="true" />
          清空所有记录
        </button>
        <p className="menu-version">{buildLabel()}</p>
      </div>
    </>
  )
}