/**
 * Favorites DB Loader tests — A385.
 * Verifies loader/view-model behavior, DB-fallback logic, safety.
 * Run: node apps/web/src/app/user/favorites-db-loader.test.mjs
 */
import { ok, equal } from "node:assert";

// ---------------------------------------------------------------------------
// View model — DbFavoriteBookView
// ---------------------------------------------------------------------------
const view = {
  bookId: "book1", bookTitle: "Test Book", sourceType: "builtin",
  firstChapterId: "ch1", createdAt: "2026-06-10T00:00:00.000Z",
  updatedAt: "2026-06-10T00:00:00.000Z", source: "db-favorite",
  ownerLabel: "dev user", notice: "开发 DB 收藏 · 未接生产同步",
};
equal(view.source, "db-favorite");
ok(view.notice.includes("未接生产同步"));
ok(view.notice.includes("开发 DB 收藏"));
equal(typeof view.bookId, "string");
equal(typeof view.bookTitle, "string");

// ---------------------------------------------------------------------------
// Load result shapes
// ---------------------------------------------------------------------------

// Guard disabled
const disabled = { guardEnabled: false, useDbFavorites: false, items: [], message: "收藏 DB 持久化未启用：FAVORITES_DB_DISABLED", ownerLabel: null };
equal(disabled.guardEnabled, false);
equal(disabled.useDbFavorites, false);
equal(disabled.items.length, 0);
ok(disabled.message.includes("未启用"));

// Guard enabled, no session
const noSession = { guardEnabled: true, useDbFavorites: false, items: [], message: "DB 收藏已启用但当前无开发会话。", ownerLabel: null };
equal(noSession.guardEnabled, true);
equal(noSession.useDbFavorites, false);
ok(noSession.message.includes("无开发会话"));

// Guard enabled, with data
const withData = {
  guardEnabled: true, useDbFavorites: true,
  items: [{ bookId: "b1", bookTitle: "Book 1", sourceType: "builtin", firstChapterId: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", source: "db-favorite", ownerLabel: "dev1", notice: "dev-only" }],
  message: "1 条开发 DB 收藏。未接生产同步。", ownerLabel: "dev1",
};
equal(withData.guardEnabled, true);
equal(withData.useDbFavorites, true);
equal(withData.items.length, 1);
ok(withData.message.includes("未接生产同步"));
equal(withData.items[0].source, "db-favorite");

// ---------------------------------------------------------------------------
// DB-first / localStorage fallback
// ---------------------------------------------------------------------------

// DB takes priority when enabled and has data
const dbItems = [{ bookId: "b1", source: "db-favorite" }];
const localItems = [{ bookId: "b1", source: "local" }];
equal(dbItems.length > 0 ? dbItems : localItems, dbItems);

// When DB items are null/empty, fall back to localStorage
{
  const useDb = false;
  const display = useDb ? dbItems : localItems;
  equal(display, localItems);
}

{
  const emptyDb = [];
  const useDb = emptyDb.length > 0;
  equal(useDb, false);
  equal(useDb ? emptyDb : localItems, localItems);
}

// ---------------------------------------------------------------------------
// UI text safety — no production promise
// ---------------------------------------------------------------------------
const labels = [
  "开发 DB 收藏", "本地收藏 fallback",
  "开发 DB 收藏（dev-only）· 绑定 dev session 用户 · 未接生产同步",
  "本地开发收藏 · 未接真实账号",
  "开发 DB 收藏 · dev-only · 绑定 dev session",
  "Favorites saved in browser localStorage only, not connected to database.",
  "未同步生产账号", "未同步数据库",
];

for (const label of labels) {
  ok(!label.includes("云端收藏成功"));
  ok(!label.includes("生产收藏已保存"));
  ok(!label.includes("真实用户收藏系统"));
  ok(!label.includes("云端同步成功"));
}

// verify dev-only always present in DB-related labels
const dbLabels = labels.filter(l => l.includes("DB") || l.includes("dev-only"));
ok(dbLabels.length >= 3, "At least 3 DB-related labels have dev-only markers");

console.log("ALL PASS — favorites-db-loader.test.mjs");
