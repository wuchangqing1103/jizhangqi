import { describe, expect, it } from 'vitest'
import { APP_VERSION, BUILD_TIME, buildLabel } from './build-info'

describe('build info', () => {
  it('版本号非空，且不是未替换的占位符', () => {
    expect(APP_VERSION.length).toBeGreaterThan(0)
    expect(APP_VERSION).not.toContain('__')
  })

  it('构建时间是一个可以被 Date 解析的时间戳', () => {
    expect(BUILD_TIME.length).toBeGreaterThan(0)
    expect(Number.isNaN(Date.parse(BUILD_TIME))).toBe(false)
  })

  it('菜单标签只显示版本号，不带日期时间', () => {
    expect(buildLabel('0.1.1')).toBe('v0.1.1')
    expect(buildLabel('0.1.1')).not.toContain('·')
    expect(buildLabel('dev')).toBe('dev')
  })

  it('菜单标签用的是打包进来的版本号', () => {
    const label = buildLabel()
    expect(label === 'dev' || label === `v${APP_VERSION}`).toBe(true)
    expect(label).not.toContain('·')
  })
})