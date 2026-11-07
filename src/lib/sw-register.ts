export interface ServiceWorkerEnvironment {
  prod: boolean
  hasServiceWorker: boolean
}

/** 只在生产构建且浏览器支持 Service Worker 时注册。 */
export function shouldRegister(env: ServiceWorkerEnvironment): boolean {
  return env.prod && env.hasServiceWorker
}

export interface RegisterDeps {
  register: (url: string, options?: { scope?: string }) => Promise<unknown>
  /** 一般是 document.baseURI，用于拼出部署子路径下的 sw.js */
  baseUrl: string
}

/**
 * 注册 app shell。失败只返回 false，不弹窗、不打断使用——
 * 离线能力是增强项，注册失败时页面本身照常工作。
 */
export async function registerAppShell({ register, baseUrl }: RegisterDeps): Promise<boolean> {
  try {
    const url = new URL('sw.js', baseUrl)
    await register(url.toString())
    return true
  } catch {
    return false
  }
}