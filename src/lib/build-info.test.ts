import { describe, expect, it } from 'vitest'
import { APP_VERSION, BUILD_TIME, SHOW_BUILD_TIME, buildLabel, formatBuildTime } from './build-info'

describe('build info', () => {
  it('版本号非空，且不是未替换的占位符', () => {
    expect(APP_VERSION.length).toBeGreaterThan(0)
    expect(APP_VERSION).not.toContain('__')
  })

  it('构建时间是一个可以被 Date 解析的时间戳', () => {
    expect(BUILD_TIME.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(BUILD_TIME))).toBe(false)
  })

  it('构建时间格式化成「MM-DD HH:mm」', () => {
    expect(formatBuildTime('2026-11-08T04:34:00.000Z')).toMatch(/^11-08 \d{2}:34$/)
    expect(formatBuildTime('not-a-date')).toBe('')
  })

  it('本轮故意带上构建时间，方便用户确认手机上是不是新包', () => {
    expect(SHOW_BUILD_TIME).toBe(true)
    expect(buildLabel('0.1.1', '2026-11-08T04:34:00.000Z')).toMatch(
      /^v0\.1\.1 · 11-08 \d{2}:34$/,
    )
  })

  it('没有构建时间时只显示版本号', () => {
    expect(buildLabel('0.1.1', '')).toBe('v0.1.1')
    expect(buildLabel('dev')).toBe('dev')
  })

  it('菜单标签用的是打包进来的版本号', () => {
    const label = buildLabel()
    expect(label === 'dev' || label.startsWith(`v${APP_VERSION}`)).toBe(true)
  })
})