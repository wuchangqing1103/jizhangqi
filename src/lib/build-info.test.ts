import { describe, expect, it } from 'vitest'
import { APP_VERSION, BUILD_TIME, buildLabel, formatBuildTime } from './build-info'

describe('build info', () => {
  it('版本号非空，且不是未替换的占位符', () => {
    expect(APP_VERSION.length).toBeGreaterThan(0)
    expect(APP_VERSION).not.toContain('__')
  })

  it('构建时间是一个可以被 Date 解析的时间戳', () => {
    expect(BUILD_TIME.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(BUILD_TIME))).toBe(false)
  })

  it('没有构建时间时回退，不显示空标签', () => {
    expect(formatBuildTime('')).toBe('')
    expect(formatBuildTime('not-a-date')).toBe('')
    expect(buildLabel('dev', '')).toBe('dev')
    expect(buildLabel('0.1.0', '')).toBe('v0.1.0')
  })

  it('把 ISO 时间格式化成菜单里的本地时间', () => {
    const iso = new Date(2026, 10, 7, 16, 50).toISOString()
    expect(formatBuildTime(iso)).toBe('2026-11-07 16:50')
    expect(buildLabel('0.1.0', iso)).toBe('v0.1.0 · 2026-11-07 16:50')
  })
})