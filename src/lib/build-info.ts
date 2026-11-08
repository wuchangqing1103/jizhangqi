declare const __APP_VERSION__: string | undefined
declare const __BUILD_TIME__: string | undefined

const injectedVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''
const injectedBuildTime = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''

/** 构建时由 vite define 注入；本地开发取不到时回退 dev */
export const APP_VERSION = injectedVersion.trim() || 'dev'

/** 构建时间戳，用来确认手机上跑的是哪一次构建 */
export const BUILD_TIME = injectedBuildTime

/** 发布收尾时改成 false，菜单就只显示版本号 */
export const SHOW_BUILD_TIME = true

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** 把 ISO 构建时间格式化成「11-08 12:34」（本地时区） */
export function formatBuildTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

/** 菜单底部那一行，例如「v0.1.2 · 11-08 12:34」；收尾时可只留版本号 */
export function buildLabel(version: string = APP_VERSION, buildTime: string = BUILD_TIME): string {
  if (version === 'dev') return 'dev'
  const stamp = SHOW_BUILD_TIME && buildTime ? formatBuildTime(buildTime) : ''
  return stamp ? `v${version} · ${stamp}` : `v${version}`
}