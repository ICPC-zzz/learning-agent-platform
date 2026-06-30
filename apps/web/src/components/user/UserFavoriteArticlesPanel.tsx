"use client";

import { useMemo } from "react";
import Link from "next/link";

import type { DbFavoriteArticleView } from "../../app/user/article-favorites-db-view-model";
import { toggleArticleFavoriteDbAction } from "../../app/user/article-favorites-db-server-action";

interface UserFavoriteArticlesPanelProps {
  hasSession?: boolean;
  dbFavorites?: DbFavoriteArticleView[] | null;
  dbEnabled?: boolean;
  ownerLabel?: string | null;
}

interface FavoriteDisplayItem {
  articleId: string;
  articleTitle: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
  createdAt: string;
  updatedAt: string;
  source: "db-article-favorite";
  ownerLabel: string | null;
  notice: string;
}

export function UserFavoriteArticlesPanel({
  hasSession = false,
  dbFavorites = null,
  dbEnabled = false,
  ownerLabel = null,
}: UserFavoriteArticlesPanelProps) {
  const dbItems = useMemo<FavoriteDisplayItem[]>(
    () =>
      (dbFavorites ?? []).map((entry) => ({
        articleId: entry.articleId,
        articleTitle: entry.articleTitle,
        sourcePlatform: entry.sourcePlatform,
        sourceName: entry.sourceName,
        originalUrl: entry.originalUrl,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        source: "db-article-favorite",
        ownerLabel: entry.ownerLabel ?? ownerLabel,
        notice: entry.notice,
      })),
    [dbFavorites, ownerLabel],
  );

  const displayItems = useMemo(() => {
    const seen = new Set<string>();
    const merged: FavoriteDisplayItem[] = [];

    for (const item of dbItems) {
      if (!seen.has(item.articleId)) {
        seen.add(item.articleId);
        merged.push(item);
      }
    }

    return merged;
  }, [dbItems]);

  const handleRemove = async (item: FavoriteDisplayItem) => {
    try {
      await toggleArticleFavoriteDbAction(
        item.articleId,
        item.articleTitle,
        item.sourcePlatform,
        item.sourceName,
        item.originalUrl,
        true,
      );
    } catch {
      // Best effort; server action enforces the authenticated user boundary.
    }
  };

  return (
    <section className="learningPanel" aria-labelledby="fav-articles-title">
      <div className="panelHeader">
        <p className="eyebrow">Favorites</p>
        <h2 id="fav-articles-title">收藏文章</h2>
        <p className="panelNote">
          {dbEnabled && dbFavorites && dbFavorites.length > 0
            ? "文章收藏来自当前登录账号的数据库记录。"
            : hasSession
              ? "当前登录账号暂无数据库收藏记录。"
              : "请先登录后查看文章收藏。"}
        </p>
      </div>

      {displayItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>暂无收藏文章</strong>
          <p>
            到{" "}
            <Link className="secondaryLink" href="/articles" style={{ fontSize: "inherit" }}>
              文章列表
            </Link>{" "}
            点击星标即可收藏。
          </p>
          {hasSession ? (
            <p style={{ color: "#64748b", fontSize: "11px", marginTop: "8px" }}>
              当前视图只读取登录账号的数据库记录，不合并浏览器本地缓存。
            </p>
          ) : null}
        </div>
      ) : (
        <div className="chunkList">
          {displayItems.map((fav) => (
            <article className="chunkItem" key={fav.articleId}>
              <div className="panelHeaderRow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow">
                    {fav.sourcePlatform} / {fav.sourceName}
                  </p>
                  <h3 style={{ margin: "4px 0" }}>{fav.articleTitle}</h3>
                  <p className="panelNote" style={{ margin: 0 }}>
                    Favorited at {fav.updatedAt}
                  </p>
                </div>
                <div
                  className="homeActions"
                  style={{
                    alignItems: "flex-end",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <Link
                    className="primaryLink"
                    href={fav.originalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    打开原文
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRemove(fav);
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      color: "#ef4444",
                      cursor: "pointer",
                      font: "inherit",
                      fontSize: "12px",
                      padding: "3px 10px",
                    }}
                  >
                    取消收藏
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
