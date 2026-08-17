# State Machine

This file is the mechanical priority contract for Awesome DSH Pet. `verify-spec-states` checks the ordered list below against `STATE_TABLE` in `lib/client/logic.mjs`.

## 优先级

1. `drag`
2. `idle`（拖拽放下缓冲）
3. `burst`（`welcome`/`celebrate`/`error`/`disappointed`）
4. `eat` / `play`
5. `wake`
6. `wait`
7. `celebrate`（回合完成窗口）
8. `working`
9. `think`
10. `joy`
11. `sleep`
12. `walk`
13. `idle`（兜底）

## Inputs

- Node half exposes burst windows through `/awesome-dsh-pet/state`.
- Client local input covers dragging, menu interactions, sleep/wake timing, walking, and working rhythm.
- Session activity maps to `think` and `wait`.

## Character Contract

Every character in `lib/assets/manifest.json` must provide all 15 states. The current characters share one Codex atlas each and select rows through `row`/`rows`.
