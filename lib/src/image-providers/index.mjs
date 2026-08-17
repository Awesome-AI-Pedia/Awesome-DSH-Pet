// 图像生成商抽象层（provider registry；纯注册表 + 类型合约）。
// 契约：
// - provider = { id, defaultModel, generateVariant(opts) → Promise<Buffer> }
// - generateVariant 输入 { baseImageDataUri, prompt, signal? }，输出 PNG/图像原始字节；
//   失败抛错（含 provider id 与原因），调用方决定重试/降级。
// - fetch 与 sleep 由 create* 工厂显式注入（可单测；生产用 globalThis.fetch + setTimeout）。
// - 新 provider 在此文件注册即可（future: openai/gemini）。
import { createDashScopeProvider } from './dashscope.mjs'

/** 已注册 provider 工厂：{ providerId → (config) → provider 实例 }。 */
const REGISTRY = {
  dashscope: createDashScopeProvider,
}

/** 已支持的 provider id 集合（供 UI/config 校验展示）。 */
export const SUPPORTED_PROVIDERS = Object.freeze(Object.keys(REGISTRY))

/**
 * 按 imageApi 配置解析 provider；未配置/未知 provider/apiKey 空 → null（调用方降级）。
 * @param {{ enabled, provider, apiKey, model }} imageApi - 来自 config.imageApi
 * @param {{ fetch?, sleep? }} deps - 依赖注入（测试用；生产缺省 globalThis.fetch / setTimeout）
 */
export function resolveProvider(imageApi, deps = {}) {
  if (imageApi === null || typeof imageApi !== 'object') return null
  if (!imageApi.enabled) return null
  if (typeof imageApi.apiKey !== 'string' || imageApi.apiKey === '') return null
  const factory = REGISTRY[imageApi.provider]
  if (factory === undefined) return null
  return factory({ apiKey: imageApi.apiKey, model: imageApi.model }, deps)
}
