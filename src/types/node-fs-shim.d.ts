// 项目没有装 @types/node（前端代码跑在浏览器里），只有 vite.config.ts 和
// pwa-assets 测试需要读两个文件。这里按需声明用到的 node:fs 子集，
// 不为两个调用点引入整个 Node 类型包；如果以后装了 @types/node，删掉本文件即可。
declare module 'node:fs' {
  export function readFileSync(path: string | URL): Uint8Array
  export function readFileSync(path: string | URL, encoding: 'utf8' | 'utf-8'): string
}