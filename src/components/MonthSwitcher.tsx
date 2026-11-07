import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonths, currentMonthKey, monthLabel } from '../lib/date'

interface MonthSwitcherProps {
  month: string
  onChange: (month: string) => void
}

export function MonthSwitcher({ month, onChange }: MonthSwitcherProps) {
  const isCurrent = month === currentMonthKey()

  return (
    <div className="month-bar">
      <button
        type="button"
        className="month-arrow"
        aria-label="上个月"
        onClick={() => onChange(addMonths(month, -1))}
      >
        <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      <div className="month-center">
        <span className="month-title">{monthLabel(month)}</span>
        {isCurrent && <span className="month-now">本月</span>}
      </div>
      <button
        type="button"
        className="month-arrow"
        aria-label="下个月"
        disabled={isCurrent}
        onClick={() => onChange(addMonths(month, 1))}
      >
        <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}