import { Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { buildLabel } from '../lib/build-info'

interface MoreMenuProps {
  onClose: () => void
  onReset: () => void
  onClear: () => void
  onExport: () => void
  onImport: () => void
}

export function MoreMenu({ onClose, onReset, onClear, onExport, onImport }: MoreMenuProps) {
  return (
    <>
      <div className="menu-backdrop" onClick={onClose} />
      <div className="more-menu" role="menu" aria-label="更多操作">
        <div className="menu-label">数据</div>
        <button type="button" role="menuitem" onClick={onExport}>
          <Download size={15} strokeWidth={1.8} aria-hidden="true" />
          导出备份
        </button>
        <button type="button" role="menuitem" onClick={onImport}>
          <Upload size={15} strokeWidth={1.8} aria-hidden="true" />
          导入备份
        </button>

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
        <p className="menu-version">{buildLabel()}</p>
      </div>
    </>
  )
}