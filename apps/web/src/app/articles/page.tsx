import type { Metadata } from "next";
import {
  getPrismaClient,
  hasDatabaseUrl,
  PrismaDailyContentRepository,
} from "@learning-agent-platform/db";

import { EmptyState, MetricPill, PageHero, PageSection } from "../_components/UserUiComponents.tsx";
import { loadArticleLibrary } from "./article-library-loader";
import { loadDailyContent as loadDailyContentFromDb } from "./daily-content-loader";
import { loadDailyContent as loadDailyContentFromJson } from "./daily-content-json-loader";
import { ArticleCenterTabs } from "./components/ArticleCenterTabs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "技术文章与日报",
  description:
    "每日技术热点、GitHub 日报、博客园和 CSDN 公开技术文章。保留原文链接，不做 AI 摘要。",
};

export default async function ArticlesPage() {
  const articleResult = loadArticleLibrary();
  const dailyContent = await loadArticleCenterDailyContent();

  let dailyError: string | undefined;
  if (dailyContent.hotspotCount === 0 && dailyContent.githubCount === 0) {
    dailyError =
      "每日热点和 GitHub 日报尚未同步。请在管理后台 /admin/sync 点击「刷新每日热点」和「刷新 GitHub 日报」触发首次同步。";
  }

  return (
    <main className="learningPage">
      <PageHero
        eyebrow="内容中心"
        title="技术文章与日报"
        subtitle="每日技术热点、GitHub 开源项目日报、博客园和 CSDN 公开技术文章元数据。版权归原作者和原平台所有。"
      >
        <MetricPill label="博客园" value={articleResult.cnblogsCount} status="success" />
        <MetricPill label="CSDN" value={articleResult.csdnCount} status="warning" />
        {articleResult.generatedAt ? (
          <MetricPill
            label="文章同步"
            value={formatSyncTime(articleResult.generatedAt)}
            status="muted"
          />
        ) : null}
        <MetricPill label="今日热点" value={dailyContent.hotspotCount} status="info" />
        <MetricPill label="GitHub项目" value={dailyContent.githubCount} status="info" />
        {dailyContent.generatedAt ? (
          <MetricPill
            label="日报同步"
            value={formatSyncTime(dailyContent.generatedAt)}
            status="muted"
          />
        ) : null}
      </PageHero>

      <PageSection
        title="资讯中心"
        note="热点和日报由管理员同步生成。博客园和 CSDN 内容来自公开 RSS 元数据。"
      >
        {articleResult.status === "empty" ? (
          <EmptyState
            title="暂无内容数据"
            description={articleResult.message ?? "请先运行采集器生成 articles.generated.json。"}
          />
        ) : (
          <ArticleCenterTabs
            articles={articleResult.articles}
            dailyContent={dailyContent}
            dailyError={dailyError}
          />
        )}
      </PageSection>
    </main>
  );
}

async function loadArticleCenterDailyContent() {
  if (hasDatabaseUrl()) {
    try {
      const repository = new PrismaDailyContentRepository(getPrismaClient());
      const data = await loadDailyContentFromDb(new Date(), repository);
      if (data.hotspotCount > 0 || data.githubCount > 0) {
        return data;
      }
      const jsonData = loadDailyContentFromJson();
      return jsonData.hotspotCount > 0 || jsonData.githubCount > 0 ? jsonData : data;
    } catch {
      return loadDailyContentFromJson();
    }
  }

  return loadDailyContentFromJson();
}

function formatSyncTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
