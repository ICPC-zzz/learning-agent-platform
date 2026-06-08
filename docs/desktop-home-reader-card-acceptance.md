# Desktop 首页两张卡片人工 GUI 验收记录（A266）

## 1. 验收范围
- 卡片 1：`#desktop-home-reader-card`（当前阅读进度）
- 卡片 2：`#desktop-home-next-action-card`（今日学习行动）
- 验收日期：2026-05-28
- 验收约束：不使用 Playwright/CDP，不扩展 GUI 自动化链路

## 2. 验收环境
- 项目路径：`E:\code\learning-agent-platform`
- 启动命令：`npx electron apps/desktop`
- 启动日志：
  - `[desktop] Loading static index.html (default mode)`
  - `[desktop] Diagnosing local web-service status for http://localhost:3000`
- 环境限制：当前 Codex 会话仅可获取终端日志，无法在本会话中操作 Electron 可视化窗口完成真实点击观察。

## 3. 人工 GUI 点击验收完成状态
- 结论：**未实际完成 GUI 点击验收**。
- 原因：当前环境无法在 Codex 会话内直接执行 Electron 窗口交互。
- 处理方式：输出四类场景人工验收手册，并结合自动化测试结果给出安全与路径证据。

## 4. 四类场景验收手册与当前记录

### 场景 A：空态（`lap.reader.localStatus.v1` 不存在）
- 手工步骤：
  - 在 Reader/首页对应同源环境清空 key：`lap.reader.localStatus.v1`
  - 刷新 Desktop 首页
  - 观察两张卡片文案与入口
- 预期：
  - 阅读进度卡片显示空态提示与“打开 Reader”
  - 今日学习行动卡片显示“打开 Reader，选择一本书开始阅读”类建议
  - 两张卡片入口为 `/reader`
- 当前会话记录：
  - 自动化测试通过：`desktop-home-reader-card.test.mjs` 空态用例、`desktop-home-next-action-card.test.mjs` 空态用例
  - 已确认入口安全回退为 `/reader`
  - GUI 点击观察：未实际完成

### 场景 B：有态（合法 JSON）
- 手工步骤：
  - 写入：
    - key：`lap.reader.localStatus.v1`
    - value：
      ```json
      {
        "schemaVersion": 1,
        "source": "reader",
        "bookId": "book demo 1",
        "chapterId": "chapter demo 1",
        "progressPercent": 45,
        "noteCount": 0,
        "bookmarkCount": 2,
        "readingSeconds": 900,
        "updatedAt": "2026-05-28T10:00:00.000Z",
        "previewOnly": true
      }
      ```
  - 刷新 Desktop 首页并点击“继续阅读”
- 预期：
  - 阅读进度卡片显示 `bookId/chapterId`、进度、笔记数、书签数、阅读时长/更新时间
  - 今日学习行动卡片显示本地规则建议，且明确不是 AI 生成
  - 入口为 `/reader?bookId=...&chapterId=...`（内部路径）
- 当前会话记录：
  - 自动化测试通过：两张卡片“有态”用例均通过
  - 路径构造规则已验证：仅 `/reader` 或带安全 query 的 `/reader?...`
  - GUI 点击观察：未实际完成

### 场景 C：坏 JSON
- 手工步骤：
  - 将 `lap.reader.localStatus.v1` 设为非法 JSON（如 `{ bad-json`）
  - 刷新 Desktop 首页
- 预期：
  - 页面不白屏、不崩溃
  - 两张卡片显示安全降级文案
  - 入口回退 `/reader`
- 当前会话记录：
  - 自动化测试通过：两张卡片坏 JSON 降级用例通过
  - 降级路径确认：`/reader`
  - GUI 点击观察：未实际完成

### 场景 D：特殊字符（编码安全）
- 手工步骤：
  - 写入包含空格/中文/特殊字符的 `bookId/chapterId`
  - 刷新后点击继续阅读，或检查链接 href
- 预期：
  - query 参数经过安全编码
  - 不出现 `http/https/file/lap` 等外部 URL
  - 跳转仍为项目内部 Reader 路径
- 当前会话记录：
  - 自动化测试通过：两张卡片特殊字符编码用例通过
  - 生成示例：`/reader?bookId=book+a%2F%3F&chapterId=chapter%3D1%262`
  - GUI 点击观察：未实际完成

## 5. 两张卡片入口路径确认（当前实现）
- 阅读进度卡片：`/reader` 或 `/reader?bookId=...&chapterId=...`
- 今日学习行动卡片：`/reader` 或 `/reader?bookId=...&chapterId=...`
- 未发现外部 URL 入口。

## 6. 问题发现情况
- 本轮未发现新的展示或路径安全 bug。
- 当前唯一阻塞：本会话无法执行 Electron 窗口内真实人工点击。

## 7. 安全边界确认
- 未调用真实 LLM。
- 未执行真实工具。
- 未启动 Agent loop。
- 未写入数据库、未做后台同步。
- 未新增 IPC/preload/nodeIntegration。
- 未放宽 CSP / `contextIsolation` / `sandbox`。
