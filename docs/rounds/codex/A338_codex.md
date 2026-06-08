# A338 Codex Round

## 修改文件

- `apps/desktop/local-reader-sync-health-panel.js`
- `apps/desktop/local-reader-sync-health-panel.test.mjs`
- `apps/desktop/main.js`
- `apps/desktop/desktop-gui-regression.test.mjs`
- `docs/rounds/codex/A338_codex.md`

## Desktop 面板入口 / 组件说明

- Desktop 静态首页仍由 `apps/desktop/index.html` 作为默认入口。
- `apps/desktop/main.js` 在静态首页刷新链里注入只读 `Reader Sync 健康状态` 面板。
- 面板通过 `desktop-navigation-shell` 之后的 DOM 插入方式呈现，不新增公开 API route。
- 面板本身是本地只读草案，只展示状态，不触发真实同步。

## 展示状态字段

面板当前展示的 safe-to-expose 状态对象字段为：

- `schemaVersion: 1`
- `source: "desktop-reader-sync-health"`
- `previewOnly: true`
- `readiness: "disabled / preview-only"`
- `auth: "not connected"`
- `databaseWrites: "disabled"`
- `idempotency: "preview contract exists"`
- `permissionGate: "required before any dev/test path"`
- `syncConnection: "真实同步未连接"`
- `productionWrites: "生产写入默认关闭"`
- `developmentMode: "开发预览"`
- `visibility: "只读状态"`

面板文案明确包含：

- `开发预览`
- `只读状态`
- `真实同步未连接`
- `生产写入默认关闭`

## 安全边界

- 只读，不写 DB。
- preview-only，不接真实同步。
- disabled-by-default，不把草案写成生产可用。
- 不接 auth provider。
- 不新增公开 API route。
- 不调用真实 LLM / tool / Agent loop。
- 不暴露 token / cookie / session / DATABASE_URL / rawDbRecord / secret。

## 验证命令和结果

- `node --test apps/desktop/local-reader-sync-health-panel.test.mjs` 通过
- `node --test apps/desktop/desktop-gui-regression.test.mjs` 通过
- `npm run lint` 通过
- `npm run typecheck` 通过

## 风险与说明

- 这次只做了 Desktop 静态首页的只读健康状态草案，没有接入真实 reader sync、真实 auth、生产写入或 schema/migration。
- GUI 回归已确认面板在 Desktop 首页可见，但它仍然只是健康状态展示，不代表同步能力已完成。

## 项目总进度

- 粗略更新：**约 58%**
