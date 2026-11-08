import { useEffect, useState, type CSSProperties } from 'react'
import { CalendarDays, Delete, X } from 'lucide-react'
import type { RecordDraft, RecordItem, RecordType } from '../types'
import { findCategory, getCategories } from '../data/categories'
import { addDays, todayStr } from '../lib/date'
import { amountInputFromCents, parseAmountInput } from '../lib/format'
import { CategoryIcon } from './CategoryIcon'

interface EntrySheetProps {
  record: RecordItem | null
  onClose: () => void
  onSubmit: (draft: RecordDraft) => void
  onRequestDelete: (record: RecordItem) => void
}

const KEYPAD = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0']

function nextAmount(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1)
  if (key === '.') {
    if (current.includes('.')) return current
    return current === '' ? '0.' : `${current}.`
  }
  const [integerPart, fractionPart] = current.split('.')
  if (fractionPart !== undefined) {
    if (fractionPart.length >= 2) return current
    return current + key
  }
  if (integerPart.length >= 8) return current
  if (current === '0') return key
  return current + key
}

export function EntrySheet({ record, onClose, onSubmit, onRequestDelete }: EntrySheetProps) {
  const isEdit = record !== null
  const [type, setType] = useState<RecordType>(record?.type ?? 'expense')
  const [amountText, setAmountText] = useState(record ? amountInputFromCents(record.amount) : '')
  const [category, setCategory] = useState(record?.category ?? 'food')
  const [date, setDate] = useState(record?.date ?? todayStr())
  const [note, setNote] = useState(record?.note ?? '')

  const categories = getCategories(type)
  const amount = parseAmountInput(amountText) ?? 0
  const canSave = amount > 0
  const today = todayStr()
  const yesterday = addDays(today, -1)
  const categoryName = findCategory(category)?.name ?? '其他'

  function switchType(next: RecordType) {
    if (next === type) return
    setType(next)
    const options = getCategories(next)
    if (!options.some((option) => option.id === category)) {
      setCategory(options[0].id)
    }
  }

  function submit() {
    if (!canSave) return
    onSubmit({ type, amount, category, date, note: note.trim() })
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return

      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'Enter') {
        if (amount > 0) {
          event.preventDefault()
          onSubmit({ type, amount, category, date, note: note.trim() })
        }
        return
      }
      if (/^\d$/.test(event.key)) {
        setAmountText((current) => nextAmount(current, event.key))
        return
      }
      if (event.key === '.') {
        setAmountText((current) => nextAmount(current, '.'))
        return
      }
      if (event.key === 'Backspace') {
        event.preventDefault()
        setAmountText((current) => nextAmount(current, 'back'))
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [amount, category, date, note, onClose, onSubmit, type])

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div
        className="entry-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? `编辑 ${categoryName} 记录` : '记一笔'}
      >
        <div className="sheet-grabber" aria-hidden="true" />
        <div className="sheet-header">
          <button type="button" className="sheet-close" aria-label="关闭记账面板" onClick={onClose}>
            <X size={16} strokeWidth={2} aria-hidden="true" />
          </button>
          <h2>{isEdit ? '编辑记录' : '记一笔'}</h2>
          {isEdit ? (
            <button
              type="button"
              className="sheet-delete"
              onClick={() => record && onRequestDelete(record)}
            >
              删除
            </button>
          ) : (
            <span className="sheet-header-spacer" aria-hidden="true" />
          )}
        </div>

        <div className="sheet-body">
          <div className="type-switch" role="group" aria-label="收支类型">
            <button
              type="button"
              className={type === 'expense' ? 'active' : ''}
              aria-pressed={type === 'expense'}
              onClick={() => switchType('expense')}
            >
              支出
            </button>
            <button
              type="button"
              className={type === 'income' ? 'active' : ''}
              aria-pressed={type === 'income'}
              onClick={() => switchType('income')}
            >
              收入
            </button>
          </div>

          <div className="date-row">
            <button
              type="button"
              className={date === today ? 'date-chip active' : 'date-chip'}
              onClick={() => setDate(today)}
            >
              今天
            </button>
            <button
              type="button"
              className={date === yesterday ? 'date-chip active' : 'date-chip'}
              onClick={() => setDate(yesterday)}
            >
              昨天
            </button>
            <label className="date-input">
              <CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />
              <input
                type="date"
                value={date}
                max={today}
                aria-label="选择日期"
                onChange={(event) => {
                  if (event.target.value) setDate(event.target.value)
                }}
              />
            </label>
          </div>

          <div className="amount-block">
            <span className="amount-label">金额（元）</span>
            <div className="amount-display">
              <span className="cny">¥</span>
              <span className={`amount-number${amountText === '' ? ' placeholder' : ''}`}>
                {amountText || '0'}
              </span>
              <span className="amount-caret" aria-hidden="true" />
            </div>
          </div>

          <div className="sheet-section-label">
            <span>选择分类</span>
            <span className="sheet-section-hint">当前：{categoryName}</span>
          </div>
          <div className="category-grid" role="group" aria-label="选择分类">
            {categories.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`category-option${category === option.id ? ' selected' : ''}`}
                aria-pressed={category === option.id}
                style={{ '--cat': option.color } as CSSProperties}
                onClick={() => setCategory(option.id)}
              >
                <span className="cat-icon" style={{ '--cat': option.color } as CSSProperties}>
                  <CategoryIcon id={option.id} size={16} />
                </span>
                <span>{option.name}</span>
              </button>
            ))}
          </div>

          <input
            className="note-input"
            type="text"
            value={note}
            maxLength={40}
            placeholder="添加备注（选填）"
            aria-label="备注"
            onChange={(event) => setNote(event.target.value)}
            onFocus={(event) => {
              // 键盘弹起时只让 .sheet-body 内部滚到输入框，别把整页顶起来（jsdom 无此 API）
              event.currentTarget.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
            }}
          />
        </div>

        <div className="sheet-footer">
          <div className="keypad">
            {KEYPAD.map((key) => (
              <button
                key={key}
                type="button"
                className="key"
                aria-label={key === '.' ? '小数点' : key}
                onClick={() => setAmountText((current) => nextAmount(current, key))}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              className="key key-back"
              aria-label="删除一位"
              onClick={() => setAmountText((current) => nextAmount(current, 'back'))}
            >
              <Delete size={20} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="save-button" disabled={!canSave} onClick={submit}>
            保存
          </button>
          <p className="keyboard-hint">键盘可直接输入 · Enter 保存 · Esc 关闭</p>
        </div>
      </div>
    </>
  )
}