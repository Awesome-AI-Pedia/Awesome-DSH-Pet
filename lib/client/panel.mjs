// 浮层面板工厂：状态卡/气泡/菜单共用的定位与视觉基调（相对角色的浮层）。
// 差异只在锚点（below/above）与视觉变体（solid=带边框阴影 / plain=纯背景），
// 内联样式是权威——宿主可能覆盖/清理 CSS 注入（见 client/index.mjs 决策说明）。

/** 面板基调（色板/圆角/字体/阴影）：单一来源，调整一处全局生效。 */
export const PANEL_THEME = {
  bg: 'rgba(24, 28, 38, .94)',      // 面板背景（状态卡/气泡/菜单统一）
  border: 'rgba(255,255,255,.10)',  // 边框色（solid 变体用）
  text: '#E8EBF2',                  // 主文字
  radius: '10px',                   // 圆角（统一）
  font: '11px',                     // 基础字号（统一）
  shadow: '0 12px 32px rgba(0,0,0,.38), 0 3px 8px rgba(0,0,0,.28)', // 浮层阴影
}

/**
 * 创建浮层面板（状态卡/气泡/菜单共用）。
 * @param {object} opts
 * @param {'below'|'above'} [opts.anchor] 相对角色：below=下方（状态卡/菜单）、above=上方（气泡）
 * @param {'solid'|'plain'} [opts.variant] solid=带边框阴影（状态卡）、plain=纯背景（气泡/菜单）
 * @param {number} [opts.offsetY] 锚点偏移（below: 角色下方间距；above: 上方间距）
 * @param {string} [opts.zIndex] 层叠
 * @param {string} [opts.display] 初始 display
 * @param {Document} [opts.doc] 文档对象（测试注入用；默认 globalThis.document）
 * @returns {{ el: HTMLElement, show: () => void, hide: () => void }}
 */
export function createPanel({ anchor = 'below', variant = 'plain', offsetY = 12, zIndex = '3', display = 'block', doc = globalThis.document } = {}) {
  const el = doc.createElement('div')
  const pos = anchor === 'above'
    ? `top: -${offsetY}px; transform: translate(-50%, -100%);`
    : `top: calc(100% + ${offsetY}px); transform: translateX(-50%);`
  const surface = variant === 'solid'
    ? `background: ${PANEL_THEME.bg}; border: 1px solid ${PANEL_THEME.border}; box-shadow: ${PANEL_THEME.shadow};`
    : `background: ${PANEL_THEME.bg};`
  // 关键样式 JS 内联（宿主可能清理 CSS 注入——position 缺失会参与文档流顶开角色）。
  el.style.cssText = [
    'position: absolute; left: 50%;', pos,
    'width: max-content;', surface,
    `color: ${PANEL_THEME.text}; font-size: ${PANEL_THEME.font};`,
    `border-radius: ${PANEL_THEME.radius}; z-index: ${zIndex};`,
    `display: ${display}; pointer-events: none;`,
  ].join(' ')
  return {
    el,
    show() { el.style.display = display },
    hide() { el.style.display = 'none' },
  }
}
