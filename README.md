# Awesome DSH Pet

DSH Web GUI 内的可扩展桌面宠物插件。

- `jingyu-zongcai`：鲸鱼总裁
- `lulu-capybara`：噜噜

## 安装

```sh
dsh plugin --profile web add /Users/icourt/Desktop/DSH-plugin/Awesome-DSH-Pet
```

安装或更新后重启 web。插件会在页面右下角显示桌面宠物，菜单里可以投喂、玩耍、切换角色。

## 配置

`settings.yaml` 中使用 `awesome-dsh-pet:` section：

```yaml
awesome-dsh-pet:
  enabled: true
  size: 110
  opacity: 1
  walk:
    enabled: true
  sleepAfterMs: 60000
```

## 快速添加你自己的宠物

三步走：**放素材 → 改 manifest → 跑门禁**。

### 1. 起个角色 id 并放素材

角色 id 只允许 `[a-z0-9-]`（会当 URL 路径用）。示例用 `my-cat`。

把 Codex 标准 8×9 spritesheet 放到：

```text
lib/assets/characters/my-cat/spritesheet.webp
```

Codex atlas 规范：8 列 × 9 行，每格 192×208（像素）。行含义：

| row | 用途 |
|---:|---|
| 0 | idle |
| 1 | running-right / walk / drag |
| 2 | running-left |
| 3 | waving / welcome / celebrate |
| 4 | jumping / play |
| 5 | failed / error / disappointed |
| 6 | waiting |
| 7 | running / working |
| 8 | review / think |

> 如果你手里只有一堆单行动作 sheet（不是 atlas），也支持——见下方"素材两种形式"。

### 2. 在 `lib/assets/manifest.json` 增加角色

在 `characters` 下加一个 key：

```json
{
  "characters": {
    "my-cat": {
      "name": "我的猫",
      "credit": "你的名字",
      "description": "一句话人设。",
      "meta": {
        "stageSize": 110,
        "atlas": { "columns": 8, "rows": 9, "cellWidth": 192, "cellHeight": 208 }
      },
      "states": {
        "idle":         { "sheet": "spritesheet.webp", "row": 0, "rows": 9, "frames": 8, "fps": 4, "playback": "blink" },
        "working":      { "sheet": "spritesheet.webp", "row": 7, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "celebrate":    { "sheet": "spritesheet.webp", "row": 3, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "error":        { "sheet": "spritesheet.webp", "row": 5, "rows": 9, "frames": 8, "fps": 8, "motion": "shake", "playback": "once" },
        "disappointed": { "sheet": "spritesheet.webp", "row": 5, "rows": 9, "frames": 8, "fps": 4, "playback": "loop" },
        "joy":          { "sheet": "spritesheet.webp", "row": 3, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "eat":          { "sheet": "spritesheet.webp", "row": 3, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "play":         { "sheet": "spritesheet.webp", "row": 4, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "drag":         { "sheet": "spritesheet.webp", "row": 1, "rows": 9, "frames": 8, "fps": 8, "playback": "loop" },
        "walk":         { "sheet": "spritesheet.webp", "row": 1, "rows": 9, "frames": 8, "fps": 8, "playback": "pingpong" },
        "sleep":        { "sheet": "spritesheet.webp", "row": 0, "rows": 9, "frames": 8, "fps": 2, "playback": "loop" },
        "wake":         { "sheet": "spritesheet.webp", "row": 3, "rows": 9, "frames": 8, "fps": 6, "playback": "once" },
        "welcome":      { "sheet": "spritesheet.webp", "row": 3, "rows": 9, "frames": 8, "fps": 6, "playback": "loop" },
        "think":        { "sheet": "spritesheet.webp", "row": 8, "rows": 9, "frames": 8, "fps": 4, "playback": "loop" },
        "wait":         { "sheet": "spritesheet.webp", "row": 6, "rows": 9, "frames": 8, "fps": 4, "playback": "loop" }
      }
    }
  }
}
```

**必备 15 状态一个都不能少**：`idle / working / celebrate / error / disappointed / joy / eat / play / drag / walk / sleep / wake / welcome / think / wait`。

上面的 atlas 行映射是通用模板，直接复制改角色 id 即可跑起来。想让某个状态换动作（例如 `eat` 走单独的表情），改对应条目的 `row` 或 `sheet` 即可。

想把新角色作为默认，把顶层的 `"default": "jingyu-zongcai"` 改成 `"my-cat"`。

### 3. 校验并重装

```sh
node scripts/gates/verify-assets.mjs   # 门禁：素材完整性 + manifest 一致性
node --test 'tests/*.test.mjs'         # 单测
dsh plugin --profile web add /Users/icourt/Desktop/DSH-plugin/Awesome-DSH-Pet   # 更新后重启 web
```

门禁会告诉你缺哪个状态、sheet 文件不存在、frames/fps 不合法等——按报错逐条修就行。

## 素材两种形式

- **Codex atlas 行**（推荐）：`{ "sheet": "spritesheet.webp", "row": 0, "rows": 9, "frames": 8, "fps": 4, "playback": "loop" }`
- **单行动作 sheet**：`{ "sheet": "idle.png", "frames": 3, "fps": 4, "playback": "loop" }`

### 字段速查

| 字段 | 说明 |
|---|---|
| `sheet` | 相对 `lib/assets/characters/<id>/` 的文件名。允许 `.png / .webp / .svg / .jpg / .jpeg / .gif / .json` |
| `frames` | 帧数（正整数）。PNG 多帧图必须满足 **宽度 = frames × 高度**（横排帧图） |
| `fps` | 播放帧率 |
| `row` / `rows` | atlas 行索引与总行数；`row < rows` |
| `playback` | `loop` / `pingpong` / `once` / `blink`。最小帧数：`pingpong≥2`、`blink≥2`，其他 ≥1 |
| `motion` | 可选运动配方：`bob / wiggle / squash / shake / sigh / hop / tilt / float / wave`。**要求 `frames === 1`**（`error` 是唯一例外，可以多帧 + 运动叠加） |

## 开发

```sh
node scripts/build-client.mjs
node scripts/gates/verify-assets.mjs
node --test 'tests/*.test.mjs'
```

`lib/client.js` 是构建产物，改 `lib/client/index.mjs` 后运行 `node scripts/build-client.mjs` 重新生成。
