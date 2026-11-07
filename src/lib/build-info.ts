declare const __APP_VERSION__: string | undefined
declare const __BUILD_TIME__: string | undefined

const injectedVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
const injectedBuildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

/** 构建时由 vite define 注入；本地开发取不到时回退 dev */
export const APP_VERSION = injectedVersion.trim() || 'dev'
export const BUILD_TIME = injectedBuildTime

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** ISO 时间戳 → 本地「YYYY-MM-DD HH:mm」，取不到或非法时返回空串 */
export function formatBuildTime(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`
}

/** 菜单底部那一行，例如「v0.1.0 · 2026-11-07 16:50」 */
export function buildLabel(version: string = APP_VERSION, buildTime: string = BUILD_TIME): string {
  const stamp = formatBuildTime(buildTime)
  if (!stamp) return version === 'dev' ? 'dev' : `v${version}`
  return `v${version} · ${stamp}`
}