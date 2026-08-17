# Sprite Spec

This file is the mechanical state contract for Awesome DSH Pet. It exists because `verify-spec-states` checks this table against `lib/client/logic.mjs` and `lib/assets/manifest.json`.

## Atlas Assets

Current bundled characters use Codex standard 8x9 atlases:

- image size: `1536x1872`
- cell size: `192x208`
- columns: `8`
- rows: `9`

Manifest state entries may point at a full atlas row:

```json
{ "sheet": "spritesheet.webp", "row": 0, "rows": 9, "frames": 8, "fps": 4, "playback": "blink" }
```

`row` is zero-based. `frames` is the number of columns used by the row.

## Atlas Row Mapping

| row | Codex state | DSH usage |
|---:|---|---|
| 0 | idle | `idle`, `sleep` |
| 1 | running-right | `walk`, `drag` |
| 2 | running-left | reserved |
| 3 | waving | `welcome`, `celebrate`, `joy`, `eat`, `wake` |
| 4 | jumping | `play` |
| 5 | failed | `error`, `disappointed` |
| 6 | waiting | `wait` |
| 7 | running | `working` |
| 8 | review | `think` |

## 状态总表（权威，15 状态）

The `播放行为` column is verified against every character in `lib/assets/manifest.json`.

| 状态 | 触发 | 帧数 | motion 配方 | 播放行为 | 画面 |
|---|---|---|---|---|---|
| `idle` | 默认 | 8 | — | `blink` | 待机 |
| `working` | 思考陪伴期随机插曲 | 8 | — | `loop` | 工作中 |
| `celebrate` | 任务完成/回合完成 | 8 | — | `loop` | 庆祝 |
| `error` | 失败/请求错误 | 8 | `shake` | `once` | 失败惊吓 |
| `disappointed` | 失败后尾段 | 8 | — | `loop` | 失落 |
| `joy` | 互动后短时 | 8 | — | `loop` | 开心 |
| `eat` | 点击投喂 | 8 | — | `loop` | 互动反馈 |
| `play` | 点击玩耍 | 8 | — | `loop` | 跳跃互动 |
| `drag` | 拖拽中 | 8 | — | `loop` | 移动拖拽 |
| `walk` | 周期游走 | 8 | — | `pingpong` | 横向移动 |
| `sleep` | 空闲后 | 8 | — | `loop` | 安静待机 |
| `wake` | 睡醒过渡 | 8 | — | `once` | 醒来反馈 |
| `welcome` | 新会话 | 8 | — | `loop` | 挥手欢迎 |
| `think` | 任一会话运行中 | 8 | — | `loop` | 审阅/思考 |
| `wait` | 等待批准 | 8 | — | `loop` | 等待 |

## Playback

- `loop`: forward loop.
- `pingpong`: forward and backward loop.
- `once`: play to the last frame and hold.
- `blink`: hold frame 0 and occasionally play one cycle.
