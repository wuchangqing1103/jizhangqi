import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RecordItem } from '../types'
import { buildBackup } from '../lib/backup'
import { BackupPanel } from './BackupPanel'
import { PRESET_ACCOUNTS } from '../lib/storage'

function makeRecord(overrides: Partial<RecordItem> = {}): RecordItem {
  return {
    id: 'r1',
    type: 'expense',
    amount: 1250,
    category: 'food',
    date: '2026-11-07',
    note: '午饭',
    createdAt: 1794031200000,
    accountId: 'acc-cash',
    ...overrides,
  }
}

function setup(records: RecordItem[] = [makeRecord()]) {
  const onImport = vi.fn()
  const onClose = vi.fn()
  render(<BackupPanel accounts={PRESET_ACCOUNTS} records={records} onClose={onClose} onImport={onImport} />)
  return { onImport, onClose }
}

function makeFile(payload: unknown, name = 'backup.json'): File {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' })
}

describe('BackupPanel', () => {
  it('导出文本是完整信封，包含当前账本的每条记录', () => {
    setup([makeRecord(), makeRecord({ id: 'r2', type: 'income', category: 'salary', note: '工资' })])

    const textarea = screen.getByLabelText('备份内容') as HTMLTextAreaElement
    const payload = JSON.parse(textarea.value) as {
      app: string
      version: number
      accounts: { id: string }[]
      records: RecordItem[]
    }
    expect(payload.app).toBe('jizhangqi')
    expect(payload.version).toBe(2)
    expect(payload.accounts).toHaveLength(PRESET_ACCOUNTS.length)
    expect(payload.records).toHaveLength(2)
    expect(textarea.value).toContain('"note": "午饭"')
    expect(textarea.value).toContain('"note": "工资"')
  })

  it('选完文件只预览，确认后才整账本替换', async () => {
    const user = userEvent.setup()
    const { onImport } = setup([makeRecord()])
    const incoming = [makeRecord({ id: 'x1', note: '导入的一笔' })]

    fireEvent.change(screen.getByLabelText('选择备份文件'), {
      target: { files: [makeFile(buildBackup({ accounts: PRESET_ACCOUNTS, records: incoming }, new Date('2026-11-07T08:50:00.000Z')))] },
    })

    expect(await screen.findByText(/有效 1 条 \/ 跳过 0 条/)).toBeInTheDocument()
    expect(screen.getByText(/将替换当前 1 条/)).toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '确认导入' }))

    expect(onImport).toHaveBeenCalledTimes(1)
    const imported = onImport.mock.calls[0][0] as { accounts: unknown[]; records: RecordItem[] }
    expect(imported.records).toEqual(incoming)
    expect(imported.accounts).toHaveLength(PRESET_ACCOUNTS.length)
  })

  it('预览后取消不会导入', async () => {
    const user = userEvent.setup()
    const { onImport } = setup()

    fireEvent.change(screen.getByLabelText('选择备份文件'), {
      target: { files: [makeFile(buildBackup({ accounts: PRESET_ACCOUNTS, records: [makeRecord({ id: 'x1' })] }))] },
    })
    await screen.findByText(/有效 1 条/)

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('button', { name: '确认导入' })).not.toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('非法文件给出提示，账本保持不变', async () => {
    const { onImport } = setup()

    fireEvent.change(screen.getByLabelText('选择备份文件'), {
      target: { files: [new File(['not json'], 'bad.json', { type: 'application/json' })] },
    })

    expect(await screen.findByRole('alert')).toHaveTextContent('文件不是有效的 JSON')
    expect(screen.queryByRole('button', { name: '确认导入' })).not.toBeInTheDocument()
    expect(onImport).not.toHaveBeenCalled()
  })

  it('关掉面板不导入任何东西，退场动画之后才通知关闭', async () => {
    const user = userEvent.setup()
    const { onImport, onClose } = setup()

    await user.click(screen.getByRole('button', { name: '关闭' }))
    expect(document.querySelector('.modal-backdrop')).toHaveClass('is-closing')
    expect(onClose).not.toHaveBeenCalled()

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(onImport).not.toHaveBeenCalled()
  })
})