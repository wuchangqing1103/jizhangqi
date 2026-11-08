import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Copy, Download, Upload, X } from 'lucide-react'
import type { Account, RecordItem } from '../types'
import { backupFileName, buildBackup, parseBackup } from '../lib/backup'
import { modalClass, useModalClose } from '../lib/useModalClose'
import { ModalLayer } from './ModalLayer'

interface BackupPanelProps {
  accounts: Account[]
  records: RecordItem[]
  onClose: () => void
  onImport: (imported: { accounts: Account[]; records: RecordItem[] }) => void
}

interface Notice {
  kind: 'info' | 'error'
  text: string
}

interface Pending {
  accounts: Account[]
  records: RecordItem[]
  total: number
  skipped: number
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsText(file)
  })
}

export function BackupPanel({ accounts, records, onClose, onImport }: BackupPanelProps) {
  // 冻结导出时刻，保证文件名与 exportedAt 一致
  const [now] = useState(() => new Date())
  const [notice, setNotice] = useState<Notice | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const { closing, close } = useModalClose(onClose)
  const fileName = backupFileName(now)
  const backupText = useMemo(
    () => JSON.stringify(buildBackup({ accounts, records }, now), null, 2),
    [accounts, records, now],
  )

  async function handleCopy() {
    try {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        throw new Error('clipboard unsupported')
      }
      await navigator.clipboard.writeText(backupText)
      setNotice({ kind: 'info', text: '已复制，粘贴到备忘录或发给自己即可' })
    } catch {
      setNotice({ kind: 'error', text: '复制失败，请长按下方文本手动全选复制' })
    }
  }

  function handleDownload() {
    try {
      if (typeof URL.createObjectURL !== 'function') throw new Error('download unsupported')
      const blob = new Blob([backupText], { type: 'application/json' })
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
      setNotice({ kind: 'info', text: `已导出 ${fileName}` })
    } catch {
      setNotice({ kind: 'error', text: '这个浏览器不支持下载，请用「复制备份」保存文本' })
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // 允许再次选同一个文件
    event.target.value = ''
    if (!file) return

    setPending(null)
    try {
      const text = await readFileText(file)
      const result = parseBackup(text)
      if (!result.ok) {
        setNotice({ kind: 'error', text: result.error })
        return
      }
      setNotice(null)
      setPending({
        accounts: result.ledger.accounts,
        records: result.ledger.records,
        total: result.total,
        skipped: result.skipped,
      })
    } catch {
      setNotice({ kind: 'error', text: '读取文件失败，请重试' })
    }
  }

  function handleConfirmImport() {
    if (!pending) return
    onImport({ accounts: pending.accounts, records: pending.records })
    setPending(null)
  }

  return (
    <ModalLayer>
      <div
        className={modalClass('backup-card', closing)}
        role="dialog"
        aria-modal="true"
        aria-label="备份与恢复"
      >
        <header className="backup-header">
          <h2>备份与恢复</h2>
          <button type="button" className="backup-close" aria-label="关闭" onClick={close}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </header>

        <section className="backup-section">
          <h3>导出备份</h3>
          <p className="backup-hint">
            下载或复制一份 JSON 文件。换手机、清了浏览器数据，都能靠它把账本找回来。
          </p>
          <div className="backup-actions">
            <button type="button" className="backup-button" onClick={handleDownload}>
              <Download size={14} strokeWidth={1.8} aria-hidden="true" />
              下载 .json
            </button>
            <button type="button" className="backup-button" onClick={handleCopy}>
              <Copy size={14} strokeWidth={1.8} aria-hidden="true" />
              复制备份
            </button>
          </div>
          <textarea
            className="backup-text"
            aria-label="备份内容"
            readOnly
            rows={5}
            value={backupText}
            onFocus={(event) => event.currentTarget.select()}
          />
          <p className="backup-file">文件名：{fileName}</p>
        </section>

        <section className="backup-section">
          <h3>导入备份</h3>
          <p className="backup-hint">
            导入会整账本替换，当前 {records.length} 条记录将被覆盖，不会按条合并。
          </p>
          <label className="backup-button backup-pick">
            <Upload size={14} strokeWidth={1.8} aria-hidden="true" />
            选择备份文件
            <input
              type="file"
              accept="application/json,.json"
              aria-label="选择备份文件"
              onChange={handleFile}
            />
          </label>

          {pending && (
            <div className="backup-preview">
              <p>
                有效 {pending.records.length} 条 / 跳过 {pending.skipped} 条（含 {pending.accounts.length}{' '}
                个账本），将替换当前 {records.length} 条
              </p>
              <div className="backup-actions">
                <button type="button" className="backup-button danger" onClick={handleConfirmImport}>
                  确认导入
                </button>
                <button type="button" className="backup-button" onClick={() => setPending(null)}>
                  取消
                </button>
              </div>
            </div>
          )}

          {notice && (
            <p
              className={notice.kind === 'error' ? 'backup-notice error' : 'backup-notice'}
              role={notice.kind === 'error' ? 'alert' : 'status'}
            >
              {notice.text}
            </p>
          )}
        </section>
      </div>
    </ModalLayer>
  )
}