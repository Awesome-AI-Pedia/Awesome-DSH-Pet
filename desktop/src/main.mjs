// 桌面宿主主入口：把 web 版 awesome-dsh-pet 直接跑在 Tauri 透明窗口里。
//
// 关键差异：
// 1. base URL：网页版 fetch('/awesome-dsh-pet/...') 走同源代理；桌面版必须显式拼 dsh 的 http://host:port。
//    做法：在 lib/client 加载之前 monkey-patch fetch / EventSource，把所有以 '/awesome-dsh-pet/' 开头的
//    相对路径重写为绝对 URL；同时 hook <img>.src setter 覆盖 spritesheet 相对路径。
// 2. 宿主容器：网页版由 dsh 注入一个宿主 div，桌面版整个 body 就是宿主。
//    lib/client 会自己 appendChild 一个 [data-awesome-dsh-pet] 到 body，index.html 里
//    的 CSS 把它居中即可。
// 3. 交互：拖拽窗口 → tauri window.startDragging；hover 检测切换鼠标穿透；右键菜单走 Tauri Menu。

import { getCurrentWindow, LogicalPosition } from '@tauri-apps/api/window'
import { Menu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu'
import { invoke } from '@tauri-apps/api/core'
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from '@tauri-apps/plugin-autostart'
import bundledManifest from '../../lib/assets/manifest.json'

// ---- 1. 拿到 dsh base URL ----
// Rust 侧启动时会调用 window.eval(`globalThis.__DSH_BASE_URL__ = '...'`) 注入；
// 兜底：URL query 或 localStorage。
const DSH_BASE_URL =
  (globalThis.__DSH_BASE_URL__ ?? '').replace(/\/+$/, '') ||
  new URLSearchParams(location.search).get('dsh') ||
  localStorage.getItem('dsh_base_url') ||
  'http://127.0.0.1:8080'
console.info('[desktop-pet] dsh base URL =', DSH_BASE_URL)

// ---- 2. 网络请求重写 ----
// lib/client 里所有请求都是 '/awesome-dsh-pet/...' 相对路径；桌面这里 origin 是
// http://127.0.0.1:1420 (vite dev)，浏览器同源策略会 CORS 拦截 dsh 服务。
// 解决：让 Rust 一次性读完响应后再返回给 WebView，绕过 CORS，也避免流式响应
// 在部分 WebKit 版本中持续占用任务队列。
const PLUGIN_PREFIX = '/awesome-dsh-pet'
const localAssetUrls = new Map([
  [
    `${PLUGIN_PREFIX}/assets/characters/jingyu-zongcai/spritesheet.webp`,
    new URL('../../lib/assets/characters/jingyu-zongcai/spritesheet.webp', import.meta.url).href,
  ],
  [
    `${PLUGIN_PREFIX}/assets/characters/lulu-capybara/spritesheet.webp`,
    new URL('../../lib/assets/characters/lulu-capybara/spritesheet.webp', import.meta.url).href,
  ],
])
const pluginRouteOf = (u) => {
  if (typeof u !== 'string') return null
  if (u.startsWith(PLUGIN_PREFIX)) {
    const url = new URL(u, DSH_BASE_URL)
    return `${url.pathname}${url.search}`
  }
  try {
    const url = new URL(u)
    return url.pathname.startsWith(PLUGIN_PREFIX) ? `${url.pathname}${url.search}` : null
  } catch {
    return null
  }
}
const pluginPathOf = (u) => pluginRouteOf(u)?.split('?')[0] ?? null
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
})
const localAssetUrl = (u) => {
  const path = pluginPathOf(u)
  return path === null ? null : localAssetUrls.get(path) ?? null
}
const resolveAssetUrl = (u) => {
  const local = localAssetUrl(u)
  if (local !== null) return local
  const route = pluginRouteOf(u)
  return route === null ? u : `${DSH_BASE_URL}${route}`
}
const fallbackPet = () => ({
  xp: 0,
  level: 1,
  titles: [],
  memory: [],
  stats: { tasksDone: 0, failures: 0, sessions: 0, activeMs: 0 },
  updatedAt: Date.now(),
})
const fallbackResponse = (u, init = {}) => {
  const path = pluginPathOf(u)
  if (path === null) return null
  const method = String(init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' && path === `${PLUGIN_PREFIX}/assets/manifest.json`) return jsonResponse(bundledManifest)
  if (method === 'GET' && path === `${PLUGIN_PREFIX}/config`) return jsonResponse({ config: { enabled: true } })
  if (method === 'GET' && path === `${PLUGIN_PREFIX}/state`) {
    return jsonResponse({
      pet: fallbackPet(),
      activity: { name: 'idle', until: 0, sessionThink: false, sessionWait: false },
      configRevision: 0,
      companionOnline: false,
    })
  }
  if (method === 'POST' && path === `${PLUGIN_PREFIX}/interact`) return jsonResponse({ ok: true, reply: '我在。' })
  return null
}

const encodeRequestBody = async (body) => {
  if (body == null) return null
  if (typeof body === 'string') return [...new TextEncoder().encode(body)]
  if (body instanceof URLSearchParams) return [...new TextEncoder().encode(body.toString())]
  if (body instanceof Blob) return [...new Uint8Array(await body.arrayBuffer())]
  if (body instanceof ArrayBuffer) return [...new Uint8Array(body)]
  if (ArrayBuffer.isView(body)) return [...new Uint8Array(body.buffer, body.byteOffset, body.byteLength)]
  throw new TypeError('Unsupported desktop request body')
}

const requestDsh = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input))
  const path = pluginRouteOf(url)
  if (path === null) throw new TypeError(`Not a ${PLUGIN_PREFIX} route`)

  const headers = new Headers(init?.headers ?? input?.headers)
  const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase()
  const result = await invoke('dsh_request', {
    method,
    path,
    body: await encodeRequestBody(init?.body),
    contentType: headers.get('content-type'),
  })
  const responseHeaders = new Headers({ 'cache-control': 'no-store' })
  if (result.contentType) responseHeaders.set('content-type', result.contentType)
  const body = result.status === 204 || result.status === 304
    ? null
    : new Uint8Array(result.body ?? [])
  return new Response(body, { status: result.status, headers: responseHeaders })
}

// fetch → Rust 命令（绕 CORS）
const nativeFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input))
  if (pluginRouteOf(url) === null) return nativeFetch(input, init)
  try {
    const res = await requestDsh(input, init)
    if (!res.ok) {
      const fallback = fallbackResponse(url, init)
      if (fallback !== null) {
        console.info('[desktop-pet] HTTP 非 2xx，使用本地兜底响应', pluginPathOf(url), res.status)
        return fallback
      }
    }
    return res
  } catch (err) {
    const fallback = fallbackResponse(url, init)
    if (fallback !== null) {
      console.info('[desktop-pet] 使用本地兜底响应', pluginPathOf(url))
      return fallback
    }
    throw err
  }
}

// EventSource（SSE）桌面桥接暂不支持流式，先用 lib/client 的 pollMs 轮询兜底：
// 直接把 EventSource 换成一个"打不开"的 stub，让 lib/client 走轮询分支。
// TODO：需要实时更新时，用 Rust 侧命令 + emit 事件替代 SSE。
globalThis.EventSource = class DesktopEventSourceStub {
  constructor() {
    this.readyState = 2 // CLOSED，触发 lib/client 的 onerror → 轮询兜底
    setTimeout(() => this.onerror?.(new Event('error')), 0)
  }
  close() {}
  addEventListener() {}
  removeEventListener() {}
}
console.info('[desktop-pet] EventSource stubbed；实时事件退化为 pollMs 轮询')

// <img>.src → 走 Rust 请求拿 blob，再 setSrc。这样 spritesheet 也绕 CORS。
// 具体做法：拦截 img.src 的 setter，若是 dsh 资源路径，先拉成 blob，
// 再把 objectURL 塞回原生 setter。
let imgProto = HTMLImageElement.prototype
let imgDesc = null
while (imgProto && !imgDesc) {
  imgDesc = Object.getOwnPropertyDescriptor(imgProto, 'src')
  imgProto = Object.getPrototypeOf(imgProto)
}
if (imgDesc?.get && imgDesc?.set) {
  const nativeSetSrc = imgDesc.set
  const nativeGetSrc = imgDesc.get
  const blobCache = new Map() // url → objectURL
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    enumerable: true,
    get() { return nativeGetSrc.call(this) },
    set(v) {
      const local = localAssetUrl(v)
      if (local !== null) {
        nativeSetSrc.call(this, local)
        return
      }
      if (pluginRouteOf(v) === null) {
        nativeSetSrc.call(this, v); return
      }
      // dsh 图片资源：走 Rust 命令 → blob → objectURL
      const cached = blobCache.get(v)
      if (cached) { nativeSetSrc.call(this, cached); return }
      const self = this
      requestDsh(v).then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        blobCache.set(v, url)
        nativeSetSrc.call(self, url)
      }).catch((err) => {
        const local = localAssetUrl(v)
        if (local !== null) {
          console.info('[desktop-pet] 图片使用本地兜底', pluginPathOf(v))
          nativeSetSrc.call(self, local)
          return
        }
        console.warn('[desktop-pet] 图片加载失败', v, err)
        self.dispatchEvent?.(new Event('error'))
      })
    },
  })
} else {
  console.warn('[desktop-pet] 无法 patch HTMLImageElement.src；spritesheet 需已带绝对路径')
}

// ---- 3. 挂载 lib/client 宠物 ----
// 相对路径导入父仓库的客户端源代码——Vite 会当作普通模块编译打包。
// 用静态 import（构造时被 Vite 解析），比 dynamic import('...') 更靠谱：
// dynamic 的字符串在 Vite 里可能被当成 URL 请求，走到 SPA fallback。
import * as clientMod from '../../lib/client/index.mjs'
const win = getCurrentWindow()
const startWindowDrag = () => win.startDragging()
// lib/client/index.mjs 的 apply(ctx) 返回一个 dispose 函数
const dispose = clientMod.apply({ resolveAssetUrl, startWindowDrag })

// ---- 4. 桌面专属交互 ----
const host = () => document.querySelector('[data-awesome-dsh-pet]')

// 4a. 精确穿透：把人物热区及打开后的菜单热区同步给 Rust。原生层使用全局鼠标
// 坐标切换 ignoresMouseEvents，因此透明区穿透后，鼠标回到人物仍能自动恢复交互。
let lastHitRegions = ''
let hitRegionFrame = 0
const syncHitRegions = async () => {
  hitRegionFrame = 0
  const petHost = host()
  const regions = []
  const addRegion = (element) => {
    if (!element) return
    const style = getComputedStyle(element)
    const rect = element.getBoundingClientRect()
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) return
    regions.push({ x: rect.left, y: rect.top, width: rect.width, height: rect.height })
  }
  addRegion(petHost?.querySelector('.pet-hitarea'))
  if (petHost?.getAttribute('aria-expanded') === 'true') addRegion(petHost.querySelector('.pet-menu'))

  const signature = JSON.stringify(regions.map((region) => Object.fromEntries(
    Object.entries(region).map(([key, value]) => [key, Math.round(value * 10) / 10]),
  )))
  if (signature === lastHitRegions) return
  lastHitRegions = signature
  try { await invoke('set_pet_hit_regions', { regions }) } catch (err) { console.warn(err) }
}
const queueHitRegionSync = () => {
  if (hitRegionFrame !== 0) return
  hitRegionFrame = requestAnimationFrame(syncHitRegions)
}
const hitRegionObserver = new MutationObserver(queueHitRegionSync)
hitRegionObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['aria-expanded', 'class', 'style'],
})
window.addEventListener('resize', queueHitRegionSync)
queueHitRegionSync()

// 4b. 右键菜单
document.addEventListener('contextmenu', async (e) => {
  e.preventDefault()
  const autostart = await isAutostartEnabled().catch(() => false)
  const menu = await Menu.new({
    items: [
      await MenuItem.new({
        id: 'toggle_autostart',
        text: autostart ? '✓ 开机自启' : '开机自启',
        action: async () => {
          if (autostart) await disableAutostart(); else await enableAutostart()
        },
      }),
      await MenuItem.new({
        id: 'center',
        text: '回到屏幕右下',
        action: async () => {
          const monitor = await (await import('@tauri-apps/api/window')).currentMonitor()
          if (!monitor) return
          const size = await win.outerSize()
          const scale = await win.scaleFactor()
          const x = monitor.size.width - size.width - Math.round(32 * scale)
          const y = monitor.size.height - size.height - Math.round(80 * scale)
          await win.setPosition(new LogicalPosition(x / scale, y / scale))
        },
      }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await MenuItem.new({
        id: 'quit',
        text: '退出',
        action: async () => { await invoke('quit_app').catch(() => win.close()) },
      }),
    ],
  })
  await menu.popup()
})

// 4c. 页面关闭清理
window.addEventListener('beforeunload', () => {
  hitRegionObserver.disconnect()
  window.removeEventListener('resize', queueHitRegionSync)
  if (hitRegionFrame !== 0) cancelAnimationFrame(hitRegionFrame)
  try { dispose?.() } catch {}
})
