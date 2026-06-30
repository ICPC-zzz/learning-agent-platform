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

  const roleLabel = session.role === "ADMIN" ? "管理员" : "学习者";
  const emailLabel = session.email ?? "未绑定邮箱";
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
      <section className="learningPanel" aria-labelledby="current-account-title">
        <div className="panelHeader">
          <p className="eyebrow">当前账号</p>
          <h2 id="current-account-title">账号信息</h2>
          <p className="panelNote">以下收藏、阅读记录和学习数据都按这个登录账号读取。</p>
        </div>
        <dl
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "12px",
            margin: "16px 0 0",
          }}
        >
          {[
            ["显示名称", session.displayName],
            ["登录邮箱", emailLabel],
            ["账号角色", roleLabel],
            ["会话状态", "数据库会话"],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                border: "1px solid var(--lap-border)",
                borderRadius: "8px",
                padding: "12px",
                background: "rgba(248, 250, 252, 0.72)",
              }}
            >
              <dt style={{ color: "var(--lap-text-muted)", fontSize: "12px", marginBottom: "6px" }}>{label}</dt>
              <dd style={{ color: "var(--lap-text-primary)", fontWeight: 700, margin: 0, overflowWrap: "anywhere" }}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
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
