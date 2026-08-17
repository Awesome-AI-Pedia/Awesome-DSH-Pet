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

settings.yaml 中使用 `awesome-dsh-pet:` section：

```yaml
awesome-dsh-pet:
  enabled: true
  size: 110
  opacity: 1
  walk:
    enabled: true
  sleepAfterMs: 60000
```

## 添加角色

把 Codex 标准 8x9 spritesheet 放到：

```text
lib/assets/characters/<character-id>/spritesheet.webp
```

然后在 `lib/assets/manifest.json` 增加角色。状态项支持两种素材：

- 单行动作 sheet：`{ "sheet": "idle.png", "frames": 3, "fps": 4, "playback": "loop" }`
- Codex atlas 行：`{ "sheet": "spritesheet.webp", "row": 0, "rows": 9, "frames": 8, "fps": 4, "playback": "loop" }`

Codex atlas 行映射：

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

## 开发

```sh
node scripts/build-client.mjs
node scripts/gates/verify-assets.mjs
node --test 'tests/*.test.mjs'
```

`lib/client.js` 是构建产物，改 `lib/client/index.mjs` 后运行 `node scripts/build-client.mjs` 重新生成。
