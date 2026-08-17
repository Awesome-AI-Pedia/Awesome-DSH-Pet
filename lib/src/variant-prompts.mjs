// AI 变体生成的 prompt 库：9 个变体状态 → 中文提示词（纯常量，可单测）。
// 契约：
// - VARIANT_STATES 是"生成变体"覆盖的状态集合（未覆盖状态继续用 idle.png + CSS motion）；
// - buildPrompt(state) 输出交给 provider 的 prompt 文本；
// - 提示词遵循"保留原图角色特征 + 换姿势/换表情"策略（stylization_all 全图风格化）；
// - 每条 prompt 显式要求透明背景（PNG）——上游 wanx 不总能保证，client 收到后
//   若非透明可回落到叠加式压缩（后续可选优化）。

/** 需要 AI 生成变体的状态（9 个）；其它状态复用 idle.png 通过 CSS motion 表达。 */
export const VARIANT_STATES = Object.freeze([
  'idle', 'working', 'celebrate', 'error', 'disappointed',
  'play', 'welcome', 'think', 'sleep',
])

/** 状态 → 中文提示词。保留 Q 版角色 + 表情/姿势变化；显式要求透明背景。 */
const PROMPTS = {
  idle: '保留原角色特征，Q 版可爱风格，站立姿势平静表情，正面视角，透明背景 PNG',
  working: '保留原角色特征，Q 版可爱风格，专注工作的姿势，双手在忙碌，认真表情，透明背景 PNG',
  celebrate: '保留原角色特征，Q 版可爱风格，欢庆姿势双手举起，开心大笑表情，透明背景 PNG',
  error: '保留原角色特征，Q 版可爱风格，惊讶震惊的表情，睁大眼睛张开嘴，头上一滴汗，透明背景 PNG',
  disappointed: '保留原角色特征，Q 版可爱风格，低头难过的姿势，沮丧失落的表情，透明背景 PNG',
  play: '保留原角色特征，Q 版可爱风格，跳跃玩耍的姿势，活泼开心表情，透明背景 PNG',
  welcome: '保留原角色特征，Q 版可爱风格，挥手打招呼的姿势，微笑迎接表情，透明背景 PNG',
  think: '保留原角色特征，Q 版可爱风格，手托下巴思考的姿势，好奇疑问的表情，透明背景 PNG',
  sleep: '保留原角色特征，Q 版可爱风格，闭眼睡觉的姿势，安静祥和表情，头上一个 Z，透明背景 PNG',
}

/** 取指定状态的 prompt；未知状态 → null（调用方跳过）。 */
export function buildPrompt(state) {
  return PROMPTS[state] ?? null
}
