# A336 Codex 轮次记录

## 本轮目标
为 Reader sync 新增 permission gate v1，并接入 dev/test-only server action core 路径，保证同步前必须检查 trusted serverUserId、bookId、chapterId、canAccessBook、canAccessChapter、canWriteProgress、explicitUserAuthorization；默认生产仍 disabled，不接真实 auth provider，不新增公开 route，不改 schema。

## 实际改动
- 新增 `apps/web/src/app/reader/reader-sync-permission-gate.ts`
- 新增 `apps/web/src/app/reader/reader-sync-permission-gate.test.mjs`
- 修改 `apps/web/src/app/reader/reader-sync-real-server-action-core.ts`
- 修改 `apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs`
- 修改 `apps/web/src/app/reader/reader-sync-real-server-action.test.mjs`
- 修改 `docs/codex-context/CURRENT_HANDOFF.md`

## 结果说明
- permission gate v1 默认 blocked，`safeToExposeToClient=true`
- gate 规则已覆盖：
  - 缺 `serverUserId` blocked
  - 缺 `bookId` / `chapterId` blocked
  - `canAccessBook=false` blocked
  - `canAccessChapter=false` blocked
  - `canWriteProgress=false` blocked
  - `explicitUserAuthorization=false` blocked
- gate 输出不透传 `rawDbRecord`、`DATABASE_URL`、`cookie`、`headers`、`secret`
- core 在 dev/test-only 执行前先调用 permission gate
- gate 不通过时，core 保持 `success=false`、`writesDatabase=false`、`callsRepository=false`
- gate 通过时，core 仍可走现有 test-only fake/dev path
- 默认生产路径仍 disabled，没有接真实 auth provider，也没有新增公开 route

## 验证
- `npm run lint` ✅
- `npm run typecheck` ✅
- `node apps/web/src/app/reader/reader-sync-permission-gate.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-real-server-action-core.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-real-server-action.test.mjs` ✅
- `node apps/web/src/app/reader/reader-sync-dev-trigger-preview.test.mjs` ✅

## 浏览器验收
- 本轮未重复浏览器验收。
- 参考 A335 的手动验收结果仍成立：默认 `/reader` 隐藏 dev trigger，开启 `LAP_READER_SYNC_DEV_TRIGGER=true` 后可见，点击后仅显示安全的 blocked / preview / test-only / error 结果。

## 安全边界
- 未接真实 auth provider
- 未新增公开 API route
- 未改 schema / migration
- 未默认生产写 DB
- 未引入 `PrismaClient` 到 client/UI
- 未输出密钥、token、password、DATABASE_URL 等敏感信息
- 未触碰 Desktop / Agent / Skill 的实现边界

## 下一轮建议
1. 继续补 Reader sync 的更细粒度权限映射，但仍保持 preview-only / disabled-by-default。
2. 若要向真实同步推进，先单独补真实 auth provider 与审计边界，不和 UI/DB 写入混做。
3. 保持 dev/test-only 路径的安全回归测试，继续防止任何“生产可用”误导文案回流。

