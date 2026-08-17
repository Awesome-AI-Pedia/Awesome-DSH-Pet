// image-providers 抽象层 + DashScope provider（fetch/sleep 注入，可单测）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProvider, SUPPORTED_PROVIDERS } from '../lib/src/image-providers/index.mjs'
import { createDashScopeProvider, DEFAULT_MODEL, POLL_INTERVAL_MS } from '../lib/src/image-providers/dashscope.mjs'

test('SUPPORTED_PROVIDERS 至少含 dashscope', () => {
  assert.ok(SUPPORTED_PROVIDERS.includes('dashscope'))
})

test('resolveProvider：enabled=false / apiKey 空 / 未知 provider → null', () => {
  assert.equal(resolveProvider(null), null)
  assert.equal(resolveProvider({ enabled: false, provider: 'dashscope', apiKey: 'k' }), null)
  assert.equal(resolveProvider({ enabled: true, provider: 'dashscope', apiKey: '' }), null)
  assert.equal(resolveProvider({ enabled: true, provider: 'unknown', apiKey: 'k' }), null)
})

test('resolveProvider：配置合法 → provider 实例', () => {
  const p = resolveProvider({ enabled: true, provider: 'dashscope', apiKey: 'sk-x', model: '' })
  assert.equal(p.id, 'dashscope')
  assert.equal(typeof p.generateVariant, 'function')
})

test('DashScope：submit → poll SUCCEEDED → download', async () => {
  const calls = []
  const fetchImpl = async (url, opts) => {
    calls.push({ url, method: opts?.method ?? 'GET' })
    if (url.endsWith('/image-synthesis')) {
      const body = JSON.parse(opts.body)
      assert.equal(body.model, DEFAULT_MODEL)
      assert.equal(body.input.function, 'stylization_all')
      assert.equal(body.input.prompt, '跳跃')
      assert.equal(body.input.base_image_url, 'data:image/png;base64,AAA')
      assert.equal(opts.headers['x-dashscope-async'], 'enable')
      assert.equal(opts.headers.authorization, 'Bearer sk-test')
      return { ok: true, json: async () => ({ output: { task_id: 't-1', task_status: 'PENDING' } }) }
    }
    if (url.endsWith('/tasks/t-1')) {
      return { ok: true, json: async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://cdn.aliyuncs.com/x.png' }] } }) }
    }
    if (url.endsWith('/x.png')) {
      return { ok: true, arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer }
    }
    throw new Error(`unexpected url ${url}`)
  }
  const provider = createDashScopeProvider({ apiKey: 'sk-test', model: '' }, { fetch: fetchImpl, sleep: () => Promise.resolve() })
  const buf = await provider.generateVariant({ baseImageDataUri: 'data:image/png;base64,AAA', prompt: '跳跃' })
  assert.ok(Buffer.isBuffer(buf))
  assert.equal(buf.length, 4)
  assert.equal(calls.filter((c) => c.url.endsWith('/image-synthesis')).length, 1)
  assert.equal(calls.filter((c) => c.url.endsWith('/tasks/t-1')).length, 1)
})

test('DashScope：poll FAILED → 抛错含 message', async () => {
  const fetchImpl = async (url) => {
    if (url.endsWith('/image-synthesis')) return { ok: true, json: async () => ({ output: { task_id: 't-x' } }) }
    if (url.endsWith('/tasks/t-x')) return { ok: true, json: async () => ({ output: { task_status: 'FAILED', message: '内容不合规' } }) }
    throw new Error('unexpected')
  }
  const provider = createDashScopeProvider({ apiKey: 'sk-x' }, { fetch: fetchImpl, sleep: () => Promise.resolve() })
  await assert.rejects(
    () => provider.generateVariant({ baseImageDataUri: 'd', prompt: 'p' }),
    /FAILED.*内容不合规/,
  )
})

test('DashScope：submit 非 2xx → 抛错含状态码', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, text: async () => 'InvalidApiKey' })
  const provider = createDashScopeProvider({ apiKey: 'bad' }, { fetch: fetchImpl, sleep: () => Promise.resolve() })
  await assert.rejects(
    () => provider.generateVariant({ baseImageDataUri: 'd', prompt: 'p' }),
    /submit 401.*InvalidApiKey/,
  )
})

test('DashScope：配置 model 覆盖默认', async () => {
  let submittedModel = null
  const fetchImpl = async (url, opts) => {
    if (url.endsWith('/image-synthesis')) {
      submittedModel = JSON.parse(opts.body).model
      return { ok: true, json: async () => ({ output: { task_id: 't', task_status: 'SUCCEEDED' } }) }
    }
    if (url.includes('/tasks/')) return { ok: true, json: async () => ({ output: { task_status: 'SUCCEEDED', results: [{ url: 'https://x.png' }] } }) }
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) }
  }
  const provider = createDashScopeProvider({ apiKey: 'k', model: 'wanx2.5-imageedit' }, { fetch: fetchImpl, sleep: () => Promise.resolve() })
  await provider.generateVariant({ baseImageDataUri: 'd', prompt: 'p' })
  assert.equal(submittedModel, 'wanx2.5-imageedit')
})

test('DashScope：POLL_INTERVAL_MS 是合理值（不刷屏、不过慢）', () => {
  assert.ok(POLL_INTERVAL_MS >= 1000 && POLL_INTERVAL_MS <= 5000)
})
