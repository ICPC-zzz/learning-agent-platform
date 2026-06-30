"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { DbRecentArticleReadingView } from "../../app/user/article-recent-reading-db-view-model";

interface UserRecentArticlesPanelProps {
  hasSession?: boolean;
  dbReadings?: DbRecentArticleReadingView[] | null;
  dbEnabled?: boolean;
  ownerLabel?: string | null;
}

interface RecentDisplayItem {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  lastReadAt: string;
  createdAt: string;
  updatedAt: string;
  source: "db-article-reading";
  ownerLabel: string | null;
  notice: string;
}

export function UserRecentArticlesPanel({
  hasSession = false,
  dbReadings = null,
  dbEnabled = false,
  ownerLabel = null,
}: UserRecentArticlesPanelProps) {
  const dbItems = useMemo<RecentDisplayItem[]>(
    () =>
      (dbReadings ?? []).map((entry) => ({
        articleId: entry.articleId,
        articleTitle: entry.articleTitle,
        sourcePlatform: entry.sourcePlatform,
        sourceName: entry.sourceName,
        originalUrl: entry.originalUrl,
        lastReadAt: entry.lastReadAt,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        source: "db-article-reading",
        ownerLabel: entry.ownerLabel ?? ownerLabel,
        notice: entry.notice,
      })),
    [dbReadings, ownerLabel],
  );

  const displayItems = useMemo(() => {
    const seen = new Set<string>();
    const merged: RecentDisplayItem[] = [];

    for (const item of dbItems) {
      if (!seen.has(item.articleId)) {
        seen.add(item.articleId);
        merged.push(item);
      }
    }

    return merged;
  }, [dbItems]);

  return (
    <section className="learningPanel" aria-labelledby="recent-articles-title">
      <div className="panelHeader">
        <p className="eyebrow">Recent</p>
        <h2 id="recent-articles-title">最近阅读文章</h2>
        <p className="panelNote">
          {dbEnabled && dbReadings && dbReadings.length > 0
            ? "最近阅读来自当前登录账号的数据库记录。"
            : hasSession
              ? "当前登录账号暂无数据库最近阅读记录。"
              : "请先登录后查看最近阅读。"}
        </p>
      </div>

      {displayItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>暂无最近阅读文章</strong>
          <p>
            到{" "}
            <Link className="secondaryLink" href="/articles" style={{ fontSize: "inherit" }}>
              文章列表
            </Link>{" "}
            点击任意文章即可记录最近阅读。
          </p>
        </div>
      ) : (
        <div className="chunkList">
          {displayItems.map((item) => (
            <article className="chunkItem" key={item.articleId}>
              <div className="panelHeaderRow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow">
                    {item.sourcePlatform} / {item.sourceName}
                  </p>
                  <h3 style={{ margin: "4px 0" }}>{item.articleTitle}</h3>
                  <p className="panelNote" style={{ margin: 0 }}>
                    Read at {item.lastReadAt}
                  </p>
                </div>
                <a
                  className="primaryLink"
                  href={item.originalUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  打开文章
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
