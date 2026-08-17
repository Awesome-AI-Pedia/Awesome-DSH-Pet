# AGENTS.md

Awesome DSH Pet 是官方 bundle 格式的 DSH Web GUI 桌面宠物插件。仓库根 `package.json` 声明 `dsh.bundle` 与 `dsh.client`，`cordis.patch.yml` 把插件挂载到 web 组合。

## 目录

```text
lib/index.mjs          Node half：state/interact/config/assets/events 路由与事件记账
lib/src/               Node half 纯逻辑
lib/client/            client bundle 源码
lib/client.js          构建产物，由 scripts/build-client.mjs 生成
lib/assets/            角色素材与 manifest.json
scripts/gates/         本地门禁
tests/                 node:test 单测
```

## 命令

```sh
node scripts/build-client.mjs
node scripts/build-client.mjs --check
node scripts/gates/verify-assets.mjs
node --test 'tests/*.test.mjs'
```

## 约定

- 改 client 源码时改 `lib/client/index.mjs`，不要手改 `lib/client.js`。
- 角色素材由 `lib/assets/manifest.json` 声明；角色 id 只允许 `[a-z0-9-]`。
- 支持普通横排动作 sheet，也支持 Codex atlas 行：状态项用 `row` + `rows` 指定 atlas 行。
- 插件命名空间、路由、localStorage 和 DOM 标记统一使用 `awesome-dsh-pet`。
