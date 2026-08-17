// DashScope 通义万相图像编辑（wanx2.1-imageedit）provider。
// 契约：
// - generateVariant({ baseImageDataUri, prompt }) 异步：POST 提交任务 → 轮询 /tasks/{id}
//   直到 SUCCEEDED/FAILED → 下载首张结果图 → 返回 Buffer。
// - fetch/sleep 显式注入（可单测）。
// - 端点单一来源常量；模型名默认 wanx2.1-imageedit，配置 model 非空则覆盖。
// - function 用 stylization_all（全图风格化不需 mask，适合"照原图换姿势/风格"）。
// - 轮询间隔 2s，最长 90s（单张动作）；上游返回 FAILED 抛错含 code+message。

/** 提交任务端点（异步接口专用，通过 header X-DashScope-Async 触发）。 */
const SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis'
/** 轮询端点前缀（append task_id）。 */
const TASK_URL_PREFIX = 'https://dashscope.aliyuncs.com/api/v1/tasks/'
/** 默认模型（配置 model 空时使用）。 */
export const DEFAULT_MODEL = 'wanx2.1-imageedit'
/** 轮询：2s 间隔、90s 超时（图像编辑通常 15-40s）。 */
export const POLL_INTERVAL_MS = 2000
export const POLL_TIMEOUT_MS = 90_000

/**
 * 创建 DashScope provider。
 * @param {{ apiKey, model }} cfg
 * @param {{ fetch?, sleep? }} deps
 */
export function createDashScopeProvider(cfg, deps = {}) {
  const fetchImpl = deps.fetch ?? globalThis.fetch
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  const model = typeof cfg.model === 'string' && cfg.model !== '' ? cfg.model : DEFAULT_MODEL

  const authHeaders = () => ({
    'authorization': `Bearer ${cfg.apiKey}`,
    'content-type': 'application/json',
  })

  return {
    id: 'dashscope',
    defaultModel: DEFAULT_MODEL,
    /**
     * 生成单张变体。抛错含 provider/step，调用方按 state 记录失败。
     * @param {{ baseImageDataUri, prompt, signal? }} opts
     * @returns {Promise<Buffer>} PNG/JPEG 字节
     */
    async generateVariant({ baseImageDataUri, prompt, signal }) {
      // 1. 提交异步任务
      const submitRes = await fetchImpl(SUBMIT_URL, {
        method: 'POST',
        headers: { ...authHeaders(), 'x-dashscope-async': 'enable' },
        body: JSON.stringify({
          model,
          input: {
            function: 'stylization_all',
            prompt,
            base_image_url: baseImageDataUri,
          },
          parameters: { n: 1 },
        }),
        signal,
      })
      if (!submitRes.ok) {
        const text = await submitRes.text().catch(() => '')
        throw new Error(`dashscope submit ${submitRes.status}: ${text.slice(0, 300)}`)
      }
      const submitBody = await submitRes.json()
      const taskId = submitBody?.output?.task_id
      if (typeof taskId !== 'string' || taskId === '') {
        throw new Error(`dashscope submit: missing task_id in response ${JSON.stringify(submitBody).slice(0, 300)}`)
      }
      // 2. 轮询任务状态
      const started = Date.now()
      let imageUrl = null
      while (Date.now() - started < POLL_TIMEOUT_MS) {
        await sleep(POLL_INTERVAL_MS)
        if (signal?.aborted) throw new Error('dashscope poll: aborted')
        const pollRes = await fetchImpl(`${TASK_URL_PREFIX}${taskId}`, {
          method: 'GET',
          headers: { 'authorization': `Bearer ${cfg.apiKey}` },
          signal,
        })
        if (!pollRes.ok) {
          // 单次轮询失败不致命：继续下一轮直至超时（网络抖动容忍）
          continue
        }
        const pollBody = await pollRes.json().catch(() => ({}))
        const status = pollBody?.output?.task_status
        if (status === 'SUCCEEDED') {
          const results = pollBody?.output?.results
          const first = Array.isArray(results) ? results[0] : null
          imageUrl = first?.url ?? null
          if (typeof imageUrl !== 'string' || imageUrl === '') {
            throw new Error('dashscope poll: SUCCEEDED but no result url')
          }
          break
        }
        if (status === 'FAILED' || status === 'UNKNOWN') {
          const msg = pollBody?.output?.message ?? JSON.stringify(pollBody).slice(0, 200)
          throw new Error(`dashscope task ${status}: ${msg}`)
        }
        // PENDING / RUNNING → 继续轮询
      }
      if (imageUrl === null) {
        throw new Error(`dashscope poll timeout (${POLL_TIMEOUT_MS}ms) task=${taskId}`)
      }
      // 3. 下载结果图（阿里返回的是临时 URL，24h 有效——立即下载落盘）
      const imgRes = await fetchImpl(imageUrl, { signal })
      if (!imgRes.ok) {
        throw new Error(`dashscope download ${imgRes.status} url=${imageUrl}`)
      }
      const arrayBuf = await imgRes.arrayBuffer()
      return Buffer.from(arrayBuf)
    },
  }
}
