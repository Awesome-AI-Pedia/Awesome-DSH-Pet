# awesome-dsh-pet · 桌面版（Tauri v2）

把 `awesome-dsh-pet` 从 dsh web GUI 内的插件搬到桌面上——透明、无边框、置顶、鼠标穿透（除宠物本体）。

**技术要点**：完全复用父仓库的 `lib/client/*.mjs`（状态机 / spritesheet 播放器 / 拖拽 / 菜单），Tauri 只提供窗口和 base URL 注入。所以 manifest / 素材 / blink 参数改动**自动同步**到桌面版。

## 一次性准备

### 1. 装 Rust
```sh
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
rustc --version  # 出现版本号即 OK
```

### 2. 装依赖
```sh
cd desktop
pnpm install
```

## 开发运行

先确保 dsh web 服务在跑（`dsh` 命令启动的那个），拿到它的端口号（假设是 `5140`）。

```sh
cd desktop
DSH_BASE_URL=http://127.0.0.1:5140 pnpm tauri dev
```

或用启动参数：
```sh
pnpm tauri dev -- -- --dsh-url=http://127.0.0.1:5140
```

或写配置文件（一次配置永久生效）：
```sh
mkdir -p "$HOME/Library/Application Support/com.yuki22.awesome-dsh-pet"
cat > "$HOME/Library/Application Support/com.yuki22.awesome-dsh-pet/config.json" <<EOF
{ "dsh_base_url": "http://127.0.0.1:5140" }
EOF
pnpm tauri dev
```

**优先级**：CLI `--dsh-url=` > 环境变量 `DSH_BASE_URL` > 配置文件 > 默认 `http://127.0.0.1:8080`

## 构建发布

```sh
cd desktop
pnpm tauri build
# 产物：desktop/src-tauri/target/release/bundle/{macos,dmg}/
```

macOS 首次运行会被 Gatekeeper 拦截，右键 → 打开一次即可（或 `xattr -cr /Applications/DesktopPet.app`）。

## 交互约定

| 操作 | 效果 |
|---|---|
| 鼠标悬停宠物 | 显示状态卡（同网页版） |
| 单击宠物 | 展开互动菜单（同网页版 · 投喂/玩耍/切角色） |
| **Alt + 拖动** | 拖动整个窗口 到屏幕任意位置 |
| 右键宠物 | 桌面专属菜单：开机自启 / 回到右下 / 退出 |
| 鼠标移出宠物区域 | 窗口自动穿透，下层窗口可点 |

> 拖动为什么要按 Alt？因为直接拖会和 lib/client 内置的"抓取宠物 → 播 drag 动画"冲突。Alt 修饰键把两种拖拽分开。

## 开机自启

右键菜单 → 「开机自启」勾选即可。macOS 走 LaunchAgent，首次生效需要一次登出登入或 `launchctl load`。取消勾选就撤销。

## 常见问题

**Q：窗口透明但看不到宠物？**
A：确认 dsh 服务在跑、`DSH_BASE_URL` 端口正确。DevTools 打开（`pnpm tauri dev` 会自动开）看 Network 是不是 CORS / 404 / connection refused。

**Q：dsh 有 CORS 限制怎么办？**
A：Tauri 的请求源是 `tauri://localhost` / `http://tauri.localhost`，如果 dsh 服务端拦，需要在 dsh 侧允许这两个 origin，或在 Rust 侧走 `tauri::http` 代理绕过（后续可加）。

**Q：想改宠物大小 / 眨眼频率 / 角色？**
A：改父仓库的 `lib/assets/manifest.json` 或 `lib/client/logic.mjs`，重跑 `node scripts/build-client.mjs`，然后重启 `pnpm tauri dev`——不需要动 desktop/ 任何代码。

**Q：全屏视频/游戏上宠物消失？**
A：macOS 全屏应用会独占一个 space；如需常驻，需要在 Rust 侧调 `NSWindow.collectionBehavior = .canJoinAllSpaces`。后续可加。

## 目录结构

```
desktop/
├── package.json          Node 依赖 + Tauri CLI
├── vite.config.js        前端构建
├── src/
│   ├── index.html        Tauri webview 入口
│   └── main.mjs          base URL 注入 + 复用 lib/client + 桌面交互
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json   窗口特性（透明/无边框/置顶/穿透）
    ├── build.rs
    ├── capabilities/
    │   └── default.json  权限声明（拖动、位置、穿透、autostart）
    ├── icons/icon.png    应用图标（默认用 spritesheet 缩放，请自行替换）
    └── src/
        ├── main.rs
        └── lib.rs        Rust 入口：解析 dsh_url、注入到 webview、自定义命令
```
