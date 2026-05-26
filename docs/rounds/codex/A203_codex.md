# A203 Codex 记录

## 任务目标
- 消除 Desktop 在非法外部 URL 场景下的重复 warning 日志噪音。
- 保持 URL 白名单、route 白名单、Reader 参数校验和回退策略不变。

## 重复 warning 原因定位
- 根因：`apps/desktop/main.js` 启动流程中，`getAllowedWebUrl()` 被调用了两次。
- 调用点：
  - `createWindow()`：用于设置 `currentAllowedOrigin`
  - `loadDesktopEntry()`：用于决定加载入口
- 当 `LAP_DESKTOP_WEB_URL=https://example.com` 时，两次调用都会输出 protocol rejected warning，造成重复日志。

## 代码修改
1. `apps/desktop/main.js`
- `loadDesktopEntry(win)` 调整为 `loadDesktopEntry(win, allowedUrl)`。
- 当 `allowedUrl` 已由 `createWindow()` 计算后，`loadDesktopEntry` 直接复用，不再重复调用 `getAllowedWebUrl()`。
- 保留原有 warning 内容与回退行为，仅去重重复来源。

2. `apps/desktop/route-policy.test.mjs`
- 新增测试：`protocol rejection does not affect later legal URL/route resolution`
- 校验非法协议拒绝后，后续合法 URL 与合法 route 解析仍正常。

3. `docs/desktop-web-loader.md`
- 追加 `A203 Addendum`，记录根因、修复方式与日志验证结果。

4. `docs/codex-context/CURRENT_HANDOFF.md`
- 追加 A203 摘要（仅追加，不压缩）。

5. `docs/rounds/codex/A203_codex.md`
- 新增本轮总结文档（本文件）。

## 验证命令与结果
1. `node --check apps/desktop/main.js`
- 结果：通过。

2. `node --test apps/desktop/route-policy.test.mjs`
- 结果：通过（11/11）。

3. `pnpm typecheck`
- 结果：通过（`typecheck passed (0 errors)`）。

4. `pnpm lint`
- 结果：通过（`VM lint complete`）。

## GUI / 日志验证结果
1. `LAP_DESKTOP_WEB_URL=http://localhost:3000` + `LAP_DESKTOP_WEB_ROUTE=/books`
- 结果：加载 `/books`，无 rejected/warning 噪音。

2. `LAP_DESKTOP_WEB_URL=https://example.com`
- 结果：仅一次 protocol rejected warning，随后回退静态首页。

3. `LAP_DESKTOP_WEB_URL=http://localhost:3000` + `LAP_DESKTOP_WEB_ROUTE=/admin?x=1`
- 结果：一次 route rejected warning，回退 `/books`。

4. 补充验证（保持行为不变）
- 合法 `/learning` 与合法 `/reader`：仅出现 loading 日志，无 rejected/warning。
- Web dev server 不可用：出现 `ERR_CONNECTION_REFUSED` 后回退静态首页。

说明：本环境通过短时启动 Electron 进程抓取日志完成验证，进程被超时结束后出现 `Exit status 143`，属于测试脚本主动终止，不是回归故障。

## 约束检查
- 是否修改 Web：否。
- 是否修改 DB / Prisma：否。
- 是否修改 Agent / Tool / LLM 真实能力：否。
- 是否修改 package manager 配置或锁文件：否。
- 是否修改 `.env` / 凭据：否。
- 是否改安全策略（`nodeIntegration/contextIsolation/sandbox`）：否。

## Git 执行情况
- 本轮未执行 `git add` / `git commit` / `git push`。

## 风险与下一步
- 当前风险：低。改动集中在 Desktop 启动调用去重，不涉及策略放宽。
- 下一步建议：后续轮次可把这类“配置校验 + 日志”路径抽成单测友好接口，减少 GUI 场景对日志采样的依赖。

## 进度
- 日志噪音修复并验证通过，项目进度更新为 **37.72%**。
