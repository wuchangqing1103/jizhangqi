/** 把「分」格式化成展示用金额：整数省略小数位，非整数保留两位 */
export function formatCents(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  const integer = Math.floor(abs / 100).toLocaleString('en-US')
  const fraction = abs % 100
  if (fraction === 0) return integer
  return `${integer}.${String(fraction).padStart(2, '0')}`
}

export function splitCents(cents: number): { integer: string; fraction: string } {
  const abs = Math.abs(Math.round(cents))
  return {
    integer: Math.floor(abs / 100).toLocaleString('en-US'),
    fraction: abs % 100 === 0 ? '' : String(abs % 100).padStart(2, '0'),
  }
}

/** 记账面板里的原始输入（如 "12.5"）转成分；格式非法返回 null */
export function parseAmountInput(text: string): number | null {
  if (!/^\d{0,8}(?:\.\d{0,2})?$/.test(text)) return null
  const [integerPart = '', fractionPart = ''] = text.split('.')
  const integer = integerPart === '' ? 0 : Number(integerPart)
  const fraction = Number(fractionPart.padEnd(2, '0'))
  return integer * 100 + fraction
}

/** 从已有记录回填到输入框，去掉多余的小数 0 */
export function amountInputFromCents(cents: number): string {
  const abs = Math.abs(Math.round(cents))
  const integer = Math.floor(abs / 100)
  const fraction = abs % 100
  if (fraction === 0) return String(integer)
  if (fraction % 10 === 0) return `${integer}.${fraction / 10}`
  return `${integer}.${String(fraction).padStart(2, '0')}`
}