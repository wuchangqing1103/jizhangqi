import { describe, expect, it } from 'vitest'
import {
  amountInputFromCents,
  formatCents,
  formatPercent,
  parseAmountInput,
  splitCents,
} from './format'

describe('formatCents', () => {
  it('整数金额省略小数位', () => {
    expect(formatCents(1200)).toBe('12')
    expect(formatCents(0)).toBe('0')
  })

  it('非整数金额保留两位小数', () => {
    expect(formatCents(1250)).toBe('12.50')
    expect(formatCents(1205)).toBe('12.05')
  })

  it('使用千分位并忽略符号', () => {
    expect(formatCents(123456789)).toBe('1,234,567.89')
    expect(formatCents(-1250)).toBe('12.50')
  })
})

describe('splitCents', () => {
  it('拆分整数和小数部分', () => {
    expect(splitCents(123456789)).toEqual({ integer: '1,234,567', fraction: '89' })
    expect(splitCents(1200)).toEqual({ integer: '12', fraction: '' })
  })
})

describe('parseAmountInput', () => {
  it('接受空串、整数、一位或两位小数', () => {
    expect(parseAmountInput('')).toBe(0)
    expect(parseAmountInput('12')).toBe(1200)
    expect(parseAmountInput('12.5')).toBe(1250)
    expect(parseAmountInput('0.05')).toBe(5)
    expect(parseAmountInput('12.')).toBe(1200)
  })

  it('拒绝非法输入', () => {
    expect(parseAmountInput('12.345')).toBeNull()
    expect(parseAmountInput('-1')).toBeNull()
    expect(parseAmountInput('1,2')).toBeNull()
    expect(parseAmountInput('123456789')).toBeNull()
    expect(parseAmountInput('abc')).toBeNull()
  })
})

describe('amountInputFromCents', () => {
  it('去掉多余的小数 0', () => {
    expect(amountInputFromCents(1250)).toBe('12.5')
    expect(amountInputFromCents(1205)).toBe('12.05')
    expect(amountInputFromCents(1200)).toBe('12')
  })
})

describe('formatPercent', () => {
  it('四舍五入到整数百分比', () => {
    expect(formatPercent(100)).toBe('100%')
    expect(formatPercent(12.6)).toBe('13%')
    expect(formatPercent(0)).toBe('0%')
  })

  it('非零但不足 1% 时不显示 0%', () => {
    expect(formatPercent(0.28)).toBe('<1%')
    expect(formatPercent(1)).toBe('1%')
  })
})