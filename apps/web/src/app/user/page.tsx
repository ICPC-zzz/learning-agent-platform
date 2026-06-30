import { redirect } from "next/navigation";

import { UserFavoriteArticlesPanel } from "../../components/user/UserFavoriteArticlesPanel";
import { UserRecentArticlesPanel } from "../../components/user/UserRecentArticlesPanel";
import { CodeforcesDashboardClient } from "./CodeforcesDashboardClient";
import {
  loadCodeforcesDashboard,
  type CodeforcesDashboardData,
} from "./codeforces-dashboard-loader";
import {
  loadDbArticleFavoritesForUser,
  type DbArticleFavoritesLoadResult,
} from "./article-favorites-db-loader";
import {
  loadDbArticleRecentReadingsForUser,
} from "./article-recent-reading-db-loader";
import type { DbArticleRecentReadingLoadResult } from "./article-recent-reading-db-view-model";
import { MetricPill, PageHero } from "../_components/UserUiComponents";
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";

export default async function UserPage() {
  const session = await getCurrentAuthSession();
  if (!session.hasSession) {
    redirect("/auth/login?returnTo=/user");
  }

  let codeforcesDashboard: CodeforcesDashboardData;
  const [articleFavorites, articleReadings] = await Promise.all([
    loadDbArticleFavoritesForUser(session.userId, session.displayName).catch(
      (): DbArticleFavoritesLoadResult => ({
        guardEnabled: false,
        useDbFavorites: false,
        items: [],
        message: "Article favorites database snapshot is currently unavailable",
        ownerLabel: null,
      }),
    ),
    loadDbArticleRecentReadingsForUser(session.userId, session.displayName, 15).catch(
      (): DbArticleRecentReadingLoadResult => ({
        guardEnabled: false,
        useDbRecentReadings: false,
        items: [],
        message: "Article recent reading database snapshot is currently unavailable",
        ownerLabel: null,
      }),
    ),
  ]);

  try {
    codeforcesDashboard = await loadCodeforcesDashboard();
  } catch {
    codeforcesDashboard = {
      hasAccount: false,
      account: null,
      stats: null,
      problemStats: [],
      ratingHistory: [],
      isSyncing: false,
      syncError: "Codeforces database snapshot is currently unavailable",
    };
  }

  return (
    <main className="learningPage">
      <PageHero
        eyebrow="个人学习画像"
        title="你的学习工作室"
        subtitle="把收藏、最近阅读、Codeforces 数据、复习计划和学习报告集中到一个长期可追踪的个人视图。"
      >
        <MetricPill label="收藏文章" value={articleFavorites.items.length} status="info" />
        <MetricPill label="最近阅读" value={articleReadings.items.length} status="muted" />
        <MetricPill label="Codeforces" value={codeforcesDashboard.hasAccount ? "已绑定" : "未绑定"} status={codeforcesDashboard.hasAccount ? "success" : "warning"} />
      </PageHero>
      <UserFavoriteArticlesPanel
        hasSession={articleFavorites.guardEnabled}
        dbFavorites={articleFavorites.items}
        dbEnabled={articleFavorites.useDbFavorites}
        ownerLabel={articleFavorites.ownerLabel}
      />
      <UserRecentArticlesPanel
        hasSession={articleReadings.guardEnabled}
        dbReadings={articleReadings.items}
        dbEnabled={articleReadings.useDbRecentReadings}
        ownerLabel={articleReadings.ownerLabel}
      />
      <CodeforcesDashboardClient data={codeforcesDashboard} />
    </main>
  );
}
