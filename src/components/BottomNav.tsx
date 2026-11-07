import { BarChart3, Plus, Receipt } from 'lucide-react'
import type { Tab } from '../types'

export type { Tab } from '../types'

interface BottomNavProps {
  tab: Tab
  onChange: (tab: Tab) => void
  onAdd: () => void
}

export function BottomNav({ tab, onChange, onAdd }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      <button
        type="button"
        className={`nav-tab${tab === 'bill' ? ' active' : ''}`}
        aria-current={tab === 'bill' ? 'page' : undefined}
        onClick={() => onChange('bill')}
      >
        <Receipt size={20} strokeWidth={1.8} aria-hidden="true" />
        <span>账单</span>
      </button>
      <div className="fab-wrap">
        <button type="button" className="fab" aria-label="记一笔" onClick={onAdd}>
          <Plus size={26} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        className={`nav-tab${tab === 'stats' ? ' active' : ''}`}
        aria-current={tab === 'stats' ? 'page' : undefined}
        onClick={() => onChange('stats')}
      >
        <BarChart3 size={20} strokeWidth={1.8} aria-hidden="true" />
        <span>统计</span>
      </button>
    </nav>
  )
}