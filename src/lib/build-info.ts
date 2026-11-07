declare const __APP_VERSION__: string | undefined
declare const __BUILD_TIME__: string | undefined

const injectedVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
const injectedBuildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

/** 构建时由 vite define 注入；本地开发取不到时回退 dev */
export const APP_VERSION = injectedVersion.trim() || 'dev'

/** 构建时间戳，保留给排查「手机上跑的是哪一版」时使用 */
export const BUILD_TIME = injectedBuildTime

/** 菜单底部那一行，只显示版本号，例如「v0.1.1」 */
export function buildLabel(version: string = APP_VERSION): string {
  return version === 'dev' ? 'dev' : `v${version}`
}