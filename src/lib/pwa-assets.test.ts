import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface ManifestIcon {
  src: string
  sizes: string
  type: string
}

interface Manifest {
  name: string
  short_name: string
  lang: string
  start_url: string
  scope: string
  display: string
  orientation: string
  background_color: string
  theme_color: string
  icons: ManifestIcon[]
}

// 测试从仓库根目录跑（vitest root），直接读 public/ 下的静态文件
const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as Manifest
const indexHtml = readFileSync('index.html', 'utf8')

function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path)
  // PNG 签名占 8 字节，紧接着是 IHDR：4 字节长度 + 4 字节类型，宽高各 4 字节大端
  const signature = String.fromCharCode(...bytes.subarray(1, 4))
  expect(signature).toBe('PNG')
  return { width: readUInt32BE(bytes, 16), height: readUInt32BE(bytes, 20) }
}

describe('PWA manifest', () => {
  it('带中文名、竖屏独立窗口和米色主题', () => {
    expect(manifest.name).toBe('记账器')
    expect(manifest.short_name).toBe('记账器')
    expect(manifest.lang).toBe('zh-CN')
    expect(manifest.display).toBe('standalone')
    expect(manifest.orientation).toBe('portrait')
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
    expect(manifest.background_color).toBe('#f3f1ec')
    expect(manifest.theme_color).toBe('#f3f1ec')
  })

  it('列出 192 与 512 两张 PNG 图标', () => {
    expect(manifest.icons).toEqual([
      { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ])
  })
})

describe('PWA 入口页', () => {
  it('禁用缩放，输入备注时界面不会被放大', () => {
    expect(indexHtml).toContain('maximum-scale=1.0')
    expect(indexHtml).toContain('user-scalable=no')
    expect(indexHtml).toContain('viewport-fit=cover')
  })

  it('JS 未就绪时先渲染首屏骨架', () => {
    expect(indexHtml).toContain('id="root"')
    expect(indexHtml).toContain('class="boot"')
  })

  it('挂上 manifest 与主屏图标', () => {
    expect(indexHtml).toContain('rel="manifest"')
    expect(indexHtml).toContain('icons/apple-touch-icon.png')
  })
})

describe('PWA 图标', () => {
  it('三张图标真实存在且尺寸正确', () => {
    expect(pngSize('public/icons/icon-192.png')).toEqual({ width: 192, height: 192 })
    expect(pngSize('public/icons/icon-512.png')).toEqual({ width: 512, height: 512 })
    expect(pngSize('public/icons/apple-touch-icon.png')).toEqual({ width: 180, height: 180 })
  })
})