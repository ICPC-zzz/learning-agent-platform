"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  getRecentArticleReadings,
  loadFavoriteArticles,
  loadRecentArticleReadings,
  type FavoriteArticleEntry,
  type RecentArticleReadingEntry,
} from "../../lib/local-user-article-store";
import type { DbFavoriteArticleView } from "../user/article-favorites-db-view-model";
import type { DbRecentArticleReadingView } from "../user/article-recent-reading-db-view-model";

interface HomeArticleStateCardProps {
  dbFavorites: DbFavoriteArticleView[];
  dbRecentReadings: DbRecentArticleReadingView[];
}

interface HomeRecentReadingMetricProps {
  dbRecentReadings: DbRecentArticleReadingView[];
}

interface HomeArticleStateItem {
  articleId: string;
  title: string;
  sourceName: string;
}

export function HomeRecentReadingMetric({ dbRecentReadings }: HomeRecentReadingMetricProps) {
  const [localRecentReadings, setLocalRecentReadings] = useState<RecentArticleReadingEntry[]>([]);

  useEffect(() => {
    setLocalRecentReadings(getRecentArticleReadings(loadRecentArticleReadings(), 15));
  }, []);

  const count = useMemo(() => {
    const localItems = localRecentReadings.map(localRecentReadingToItem);
    const dbItems = dbRecentReadings.map(dbRecentReadingToItem);
    return mergeByArticleId(localItems, dbItems).length;
  }, [dbRecentReadings, localRecentReadings]);

  return (
    <Link href="/articles">
      <strong>{count}</strong>
      <span>最近阅读</span>
    </Link>
  );
}

export function HomeArticleStateCard({
  dbFavorites,
  dbRecentReadings,
}: HomeArticleStateCardProps) {
  const [hydrated, setHydrated] = useState(false);
  const [localFavorites, setLocalFavorites] = useState<FavoriteArticleEntry[]>([]);
  const [localRecentReadings, setLocalRecentReadings] = useState<RecentArticleReadingEntry[]>([]);

  useEffect(() => {
    setLocalFavorites(loadFavoriteArticles());
    setLocalRecentReadings(getRecentArticleReadings(loadRecentArticleReadings(), 15));
    setHydrated(true);
  }, []);

  const favoriteItems = useMemo(() => {
    const localItems = localFavorites.map(localFavoriteToItem);
    const dbItems = dbFavorites.map(dbFavoriteToItem);
    return mergeByArticleId(localItems, dbItems);
  }, [dbFavorites, localFavorites]);

  const recentReadingItems = useMemo(() => {
    const localItems = localRecentReadings.map(localRecentReadingToItem);
    const dbItems = dbRecentReadings.map(dbRecentReadingToItem);
    return mergeByArticleId(localItems, dbItems);
  }, [dbRecentReadings, localRecentReadings]);

  const totalCount = favoriteItems.length + recentReadingItems.length;

  return (
    <Link className="a519-dashboard-card" href="/user">
      <div className="a519-card-head">
        <h2>收藏与最近阅读</h2>
        <span>{totalCount} 条</span>
      </div>
      <div className="a519-feed-list">
        {favoriteItems.slice(0, 2).map((item) => (
          <span key={`favorite-${item.articleId}`}>
            <strong>收藏：{item.title}</strong>
            <small>{item.sourceName}</small>
          </span>
        ))}
        {recentReadingItems.slice(0, 2).map((item) => (
          <span key={`recent-${item.articleId}`}>
            <strong>最近：{item.title}</strong>
            <small>{item.sourceName}</small>
          </span>
        ))}
        {totalCount === 0 ? (
          <span>
            {hydrated ? "当前浏览器暂无收藏和最近阅读记录。" : "正在读取浏览器本地收藏和最近阅读..."}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

function localFavoriteToItem(entry: FavoriteArticleEntry): HomeArticleStateItem {
  return {
    articleId: entry.articleId,
    title: entry.title,
    sourceName: entry.sourceName,
  };
}

function dbFavoriteToItem(entry: DbFavoriteArticleView): HomeArticleStateItem {
  return {
    articleId: entry.articleId,
    title: entry.articleTitle,
    sourceName: entry.sourceName,
  };
}

function localRecentReadingToItem(entry: RecentArticleReadingEntry): HomeArticleStateItem {
  return {
    articleId: entry.articleId,
    title: entry.title,
    sourceName: entry.sourceName,
  };
}

function dbRecentReadingToItem(entry: DbRecentArticleReadingView): HomeArticleStateItem {
  return {
    articleId: entry.articleId,
    title: entry.articleTitle,
    sourceName: entry.sourceName,
  };
}

function mergeByArticleId(
  primaryItems: readonly HomeArticleStateItem[],
  secondaryItems: readonly HomeArticleStateItem[],
): HomeArticleStateItem[] {
  const seen = new Set<string>();
  const merged: HomeArticleStateItem[] = [];

  for (const item of [...primaryItems, ...secondaryItems]) {
    if (seen.has(item.articleId)) continue;
    seen.add(item.articleId);
    merged.push(item);
  }

  return merged;
}
