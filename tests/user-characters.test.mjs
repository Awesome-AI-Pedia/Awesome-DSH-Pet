// user-characters 纯函数：id 生成/校验、manifest 合并、单帧模板。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  USER_ID_PREFIX, USER_CHARACTER_MAX, UPLOAD_BYTE_LIMIT, ALLOWED_MIME,
  newUserCharacterId, isUserCharacterId, buildSingleFrameManifest, mergeManifests,
} from '../lib/src/user-characters.mjs'

test('常量：字节上限 5MB、上限 20 角色', () => {
  assert.equal(UPLOAD_BYTE_LIMIT, 5 * 1024 * 1024)
  assert.equal(USER_CHARACTER_MAX, 20)
  assert.equal(USER_ID_PREFIX, 'user-')
  assert.ok(ALLOWED_MIME.has('image/png'))
  assert.ok(ALLOWED_MIME.has('image/webp'))
  assert.ok(!ALLOWED_MIME.has('image/svg+xml'))
})

test('newUserCharacterId 生成 user-<8hex>，可 seed 复现', () => {
  const a = newUserCharacterId(Buffer.from('seed-a'))
  const b = newUserCharacterId(Buffer.from('seed-a'))
  assert.equal(a, b, '同 seed 应产出同 id')
  assert.match(a, /^user-[0-9a-f]{8}$/)
  const rand = newUserCharacterId()
  assert.match(rand, /^user-[0-9a-f]{8}$/)
})

test('isUserCharacterId 严格前缀 + 字符集校验', () => {
  assert.ok(isUserCharacterId('user-abc123'))
  assert.ok(!isUserCharacterId('jingyu-zongcai'))
  assert.ok(!isUserCharacterId('user-')) // 空后缀拒绝
  assert.ok(!isUserCharacterId('user-AB')) // 大写拒绝（URL 安全）
  assert.ok(!isUserCharacterId('user-../a')) // 路径穿越拒绝
  assert.ok(!isUserCharacterId(null))
})

test('buildSingleFrameManifest 覆盖全部 15 状态且 frames=1', () => {
  const m = buildSingleFrameManifest('user-abcd1234', '我的宠物')
  const REQUIRED = ['idle', 'working', 'celebrate', 'error', 'disappointed', 'joy',
    'eat', 'play', 'drag', 'walk', 'sleep', 'wake', 'welcome', 'think', 'wait']
  for (const s of REQUIRED) {
    assert.ok(m.states[s], `缺状态 ${s}`)
    assert.equal(m.states[s].frames, 1, `${s} frames 应为 1（CSS motion 路径）`)
    assert.equal(m.states[s].sheet, 'idle.png', `${s} sheet 应指向 idle.png`)
    assert.ok(typeof m.states[s].motion === 'string', `${s} 应有 motion 类`)
  }
})

test('mergeManifests 内置优先 + 过滤非 user- 前缀', () => {
  const builtIn = {
    characters: { 'jingyu-zongcai': { name: '鲸鱼' } },
    default: 'jingyu-zongcai',
  }
  const user = {
    characters: {
      'user-aaaa1111': { name: '我的宠物' },
      'jingyu-zongcai': { name: '恶意覆盖' }, // 应被拒
      'evil': { name: '非 user- 前缀' }, // 应被拒
    },
  }
  const merged = mergeManifests(builtIn, user)
  assert.equal(merged.characters['user-aaaa1111'].name, '我的宠物')
  assert.equal(merged.characters['jingyu-zongcai'].name, '鲸鱼', '内置应优先')
  assert.ok(!('evil' in merged.characters))
  assert.equal(merged.default, 'jingyu-zongcai')
})

test('mergeManifests：user 缺失/空对象不崩', () => {
  const builtIn = { characters: { a: {} }, default: 'a' }
  assert.deepEqual(mergeManifests(builtIn, null).characters, { a: {} })
  assert.deepEqual(mergeManifests(builtIn, {}).characters, { a: {} })
  assert.deepEqual(mergeManifests(builtIn, { characters: {} }).characters, { a: {} })
})
