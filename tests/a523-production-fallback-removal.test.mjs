import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const formalRouteSources = [
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/articles/page.tsx",
  "apps/web/src/app/articles/components/ArticleLibraryClient.tsx",
  "apps/web/src/app/articles/components/ArticleCenterTabs.tsx",
  "apps/web/src/components/articles/FavoriteArticleButton.tsx",
  "apps/web/src/app/problems/page.tsx",
  "apps/web/src/app/ai/page.tsx",
  "apps/web/src/app/_components/AssistantConversationStore.tsx",
  "apps/web/src/app/_components/AssistantChatPanel.tsx",
  "apps/web/src/app/user/page.tsx",
  "apps/web/src/app/auth/login/page.tsx",
  "apps/web/src/app/auth/login/email-otp-actions.ts",
  "apps/web/src/app/auth/login/email-otp-verify-actions.ts",
  "apps/web/src/app/auth/logout/actions.ts",
  "apps/web/src/app/admin/page.tsx",
  "apps/web/src/app/admin/sync/page.tsx",
];

function read(path) {
  return readFileSync(path, "utf8");
}

test("A523 formal routes do not use lap-web-dev-session as authority", () => {
  for (const path of formalRouteSources) {
    const source = read(path);
    if (path.endsWith("email-otp-verify-actions.ts") || path.endsWith("logout/actions.ts")) {
      continue;
    }
    assert.doesNotMatch(source, /lap-web-dev-session/, path);
    assert.doesNotMatch(source, /deserializeDevSession/, path);
    assert.doesNotMatch(source, /userIdPreview/, path);
  }
});

test("A523 formal articles route no longer writes local user business data", () => {
  for (const path of [
    "apps/web/src/app/articles/components/ArticleLibraryClient.tsx",
    "apps/web/src/app/articles/components/ArticleCenterTabs.tsx",
    "apps/web/src/components/articles/FavoriteArticleButton.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /local-user-article-store/, path);
    assert.doesNotMatch(source, /persistFavoriteArticles|persistRecentArticleReadings/, path);
    assert.doesNotMatch(source, /loadFavoriteArticles|loadRecentArticleReadings/, path);
  }
});

test("A523 formal AI route does not hydrate from client localStorage fallback", () => {
  for (const path of [
    "apps/web/src/app/_components/AssistantConversationStore.tsx",
    "apps/web/src/app/_components/AssistantChatPanel.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /localStorage/, path);
    assert.doesNotMatch(source, /local-user-library-store|local-user-problem-store|local-user-article-store/, path);
  }
});

test("A523 unauthenticated formal actions guide login instead of faking success", () => {
  const favoriteAction = read("apps/web/src/app/user/article-favorites-db-server-action.ts");
  const readingAction = read("apps/web/src/app/user/article-recent-reading-db-server-action.ts");
  assert.match(favoriteAction, /请先登录后再收藏文章/);
  assert.match(favoriteAction, /success:\s*false/);
  assert.match(readingAction, /success:\s*false/);
  assert.doesNotMatch(favoriteAction, /已保留本地状态/);
});
