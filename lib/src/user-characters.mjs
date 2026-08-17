// 用户自定义角色：manifest 合并 + id 生成/校验 + 上限（纯函数，可单测）。
// 契约：
// - 用户角色 id 强制 `user-<hex>` 前缀（与内置角色隔离，DELETE 只允许此前缀）；
// - 与内置角色 manifest 合并：同 id 冲突以内置为准（用户不能覆盖内置）；
// - USER_CHARACTER_MAX 硬上限：防目录/磁盘无限增长；
// - 单帧角色（方案 A）：9 状态共用一张 idle.png + 各自 motion CSS 动画；
//   变体角色（方案 B 未来）：多状态各自图，兼容 buildSingleFrameManifest 之外的路径。
import { createHash, randomBytes } from 'node:crypto'

/** 用户角色 id 前缀（严格隔离，DELETE 白名单）。 */
export const USER_ID_PREFIX = 'user-'
/** 用户角色总数上限（每角色至少 9 张图 + manifest，20 上限即 <200 文件）。 */
export const USER_CHARACTER_MAX = 20
/** 单文件字节上限（抠好后的透明 PNG 通常 <1MB，5MB 覆盖大图）。 */
export const UPLOAD_BYTE_LIMIT = 5 * 1024 * 1024
/** 允许的图像 MIME（上传路由校验）。 */
export const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp'])

/**
 * 生成新用户角色 id：user-<8 hex>（256^8 ≈ 1e19，碰撞可忽略）。
 * 提供 seedBytes 时用 sha256 派生（测试可复现）；缺省用 randomBytes（生产随机）。
 */
export function newUserCharacterId(seedBytes = null) {
  const bytes = seedBytes ?? randomBytes(4)
  const hex = seedBytes
    ? createHash('sha256').update(Buffer.from(seedBytes)).digest('hex').slice(0, 8)
    : Buffer.from(bytes).toString('hex')
  return `${USER_ID_PREFIX}${hex}`
}

/** 判定 id 是否为用户角色（DELETE 白名单、目录净化）。 */
export function isUserCharacterId(id) {
  return typeof id === 'string' && id.startsWith(USER_ID_PREFIX) && /^user-[a-z0-9-]+$/.test(id)
}

/**
 * 构建单帧角色 manifest 条目（方案 A）：9 状态共用一张 idle.png，
 * 每状态挂不同 motion CSS 类，视觉上会摇/跳/挥手/抖动/叹气/歪头等。
 * frames=1 触发 CSS motion 路径（见 client/index.mjs 的 pet-motion-* 类）。
 */
export function buildSingleFrameManifest(id, name, sheetName = 'idle.png') {
  const S = (motion, playback = 'loop') => ({
    sheet: sheetName, frames: 1, fps: 1, playback, motion,
  })
  return {
    name,
    credit: '用户上传',
    description: '由用户照片生成的宠物。',
    meta: { stageSize: 110 },
    states: {
      idle: S('bob'),
      working: S('float'),
      celebrate: S('hop'),
      error: S('shake', 'once'),
      disappointed: S('sigh'),
      joy: S('hop'),
      eat: S('squash'),
      play: S('wiggle'),
      drag: S('wiggle'),
      walk: S('bob'),
      sleep: S('sigh'),
      wake: S('hop', 'once'),
      welcome: S('wave'),
      think: S('tilt'),
      wait: S('float'),
    },
  }
}

/**
 * 合并内置 manifest 与用户 manifest（内置优先——同 id 冲突时保留内置，
 * 防用户覆盖内置角色的意外/恶意行为）。
 * @param {object} builtIn - lib/assets/manifest.json 结构
 * @param {object} user - { characters: {...} } 结构，user 键会被过滤到 user- 前缀
 */
export function mergeManifests(builtIn, user) {
  const userChars = user?.characters ?? {}
  const merged = { ...(builtIn?.characters ?? {}) }
  for (const [id, ch] of Object.entries(userChars)) {
    if (!isUserCharacterId(id)) continue // 严格前缀过滤
    if (id in merged) continue // 内置优先
    merged[id] = ch
  }
  return {
    ...builtIn,
    characters: merged,
    default: typeof builtIn?.default === 'string' ? builtIn.default : Object.keys(merged)[0],
  }
}
