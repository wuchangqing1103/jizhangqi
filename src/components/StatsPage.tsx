import { useState, type CSSProperties } from 'react'
import { BarChart3 } from 'lucide-react'
import type { RecordItem, RecordType } from '../types'
import { findCategory } from '../data/categories'
import { monthLabel } from '../lib/date'
import { formatCents, formatPercent, splitCents } from '../lib/format'
import { categoryBreakdown, monthRecords, summarize } from '../lib/stats'
import { CategoryIcon } from './CategoryIcon'

interface StatsPageProps {
  month: string
  records: RecordItem[]
}

export function StatsPage({ month, records }: StatsPageProps) {
  const [type, setType] = useState<RecordType>('expense')
  const monthItems = monthRecords(records, month)
  const summary = summarize(monthItems)
  const totals = categoryBreakdown(monthItems, type)
  const total = type === 'expense' ? summary.expense : summary.income
  const count = totals.reduce((sum, item) => sum + item.count, 0)
  const split = splitCents(total)
  const typeLabel = type === 'expense' ? '支出' : '收入'

  return (
    <section className="page stats-page" aria-label={`${monthLabel(month)}统计`}>
      <div className="type-switch stats-switch" role="group" aria-label="统计类型">
        <button
          type="button"
          className={type === 'expense' ? 'active' : ''}
          aria-pressed={type === 'expense'}
          onClick={() => setType('expense')}
        >
          支出
        </button>
        <button
          type="button"
          className={type === 'income' ? 'active' : ''}
          aria-pressed={type === 'income'}
          onClick={() => setType('income')}
        >
          收入
        </button>
      </div>

      <div className="stats-hero">
        <div className="stats-label">本月{typeLabel}</div>
        <div className="stats-amount-row">
          <div className="stats-amount">
            <span className="cny">¥</span>
            {split.integer}
            {split.fraction && <span className="stats-fraction">.{split.fraction}</span>}
          </div>
          <span className="stats-count">{count} 笔</span>
        </div>

        {totals.length > 0 ? (
          <div className="stack-bar" aria-hidden="true">
            {totals.map((item) => (
              <span
                key={item.category}
                style={
                  {
                    width: `${item.percent}%`,
                    background: findCategory(item.category)?.color ?? '#8c8a83',
                  } as CSSProperties
                }
              />
            ))}
          </div>
        ) : (
          <div className="stack-bar stack-bar-empty" aria-hidden="true" />
        )}
      </div>

      <div className="list-heading">
        <h2>分类占比</h2>
        <span>{totals.length > 0 ? '按金额从高到低' : '暂无数据'}</span>
      </div>

      {totals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <BarChart3 size={24} strokeWidth={1.6} aria-hidden="true" />
          </div>
          <h3>这个月还没有{typeLabel}</h3>
          <p>{type === 'expense' ? '记几笔支出后，这里会告诉你钱花在哪。' : '有收入进账后，这里会按来源排序。'}</p>
        </div>
      ) : (
        <div className="stats-list">
          {totals.map((item) => {
            const category = findCategory(item.category)
            return (
              <div className="stats-row" key={item.category}>
                <div className="stats-row-top">
                  <span
                    className="cat-icon"
                    style={{ '--cat': category?.color ?? '#8c8a83' } as CSSProperties}
                  >
                    <CategoryIcon id={item.category} size={16} />
                  </span>
                  <span className="stats-name">
                    {category?.name ?? '其他'}
                    <em>{item.count} 笔</em>
                  </span>
                  <span className="stats-value">¥{formatCents(item.amount)}</span>
                  <span className="stats-percent">{formatPercent(item.percent)}</span>
                </div>
                <div className="stats-track">
                  <span
                    style={
                      {
                        width: `${Math.max(item.percent, 1.5)}%`,
                        background: category?.color ?? '#8c8a83',
                      } as CSSProperties
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}