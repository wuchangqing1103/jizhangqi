import { describe, expect, it, vi } from 'vitest'
import { registerAppShell, shouldRegister } from './sw-register'

describe('shouldRegister', () => {
  it('只在生产构建且浏览器支持时注册', () => {
    expect(shouldRegister({ prod: false, hasServiceWorker: true })).toBe(false)
    expect(shouldRegister({ prod: true, hasServiceWorker: false })).toBe(false)
    expect(shouldRegister({ prod: true, hasServiceWorker: true })).toBe(true)
  })
})

describe('registerAppShell', () => {
  it('用 baseUrl 拼出 sw.js 并只注册一次', async () => {
    const register = vi.fn().mockResolvedValue(undefined)

    await expect(
      registerAppShell({ register, baseUrl: 'https://example.com/jz/' }),
    ).resolves.toBe(true)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register.mock.calls[0][0]).toBe('https://example.com/jz/sw.js')
  })

  it('register 抛错时返回 false，不把错误抛给调用方', async () => {
    const register = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(registerAppShell({ register, baseUrl: 'https://example.com/' })).resolves.toBe(
      false,
    )
  })
})