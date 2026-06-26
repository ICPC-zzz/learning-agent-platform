"use client";

import { useCallback, useEffect, useState } from "react";

import {
  addFavoriteArticle,
  isFavoriteArticle,
  loadFavoriteArticles,
  persistFavoriteArticles,
  removeFavoriteArticle,
  type FavoriteArticleEntry,
} from "../../lib/local-user-article-store";
import {
  checkArticleFavoriteDbAction,
  toggleArticleFavoriteDbAction,
} from "../../app/user/article-favorites-db-server-action";

interface FavoriteArticleButtonProps {
  articleId: string;
  title: string;
  sourcePlatform: string;
  sourceName: string;
  originalUrl: string;
}

export function FavoriteArticleButton({
  articleId,
  title,
  sourcePlatform,
  sourceName,
  originalUrl,
}: FavoriteArticleButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const favorites = loadFavoriteArticles();
    setFavorited(isFavoriteArticle(favorites, articleId));
    setMounted(true);

    checkArticleFavoriteDbAction(articleId)
      .then((result) => {
        if (result.success && result.isFavorite) {
          setFavorited(true);
          if (!isFavoriteArticle(favorites, articleId)) {
            const entry: FavoriteArticleEntry = {
              articleId,
              title,
              sourcePlatform,
              sourceName,
              originalUrl,
              updatedAt: new Date().toISOString(),
            };
            persistFavoriteArticles(addFavoriteArticle(favorites, entry));
          }
        }
      })
      .catch(() => {
        // Best effort only.
      });
  }, [articleId, originalUrl, sourceName, sourcePlatform, title]);

  const toggle = useCallback(async () => {
    if (pending) return;

    const nextIsFavorite = !favorited;
    const favorites = loadFavoriteArticles();

    if (nextIsFavorite) {
      const entry: FavoriteArticleEntry = {
        articleId,
        title,
        sourcePlatform,
        sourceName,
        originalUrl,
        updatedAt: new Date().toISOString(),
      };
      persistFavoriteArticles(addFavoriteArticle(favorites, entry));
    } else {
      persistFavoriteArticles(removeFavoriteArticle(favorites, articleId));
    }

    setFavorited(nextIsFavorite);
    setPending(true);
    try {
      await toggleArticleFavoriteDbAction(
        articleId,
        title,
        sourcePlatform,
        sourceName,
        originalUrl,
        favorited,
      );
    } catch {
      // localStorage already updated; DB is best effort here.
    } finally {
      setPending(false);
    }
  }, [articleId, favorited, originalUrl, pending, sourceName, sourcePlatform, title]);

  if (!mounted) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void toggle();
      }}
      aria-pressed={favorited}
      aria-label={favorited ? `取消收藏 ${title}` : `收藏 ${title}`}
      title={favorited ? "已收藏文章，点击取消" : "收藏文章"}
      disabled={pending}
      style={{
        alignItems: "center",
        background: favorited ? "#fef3c7" : "#fff",
        border: favorited ? "1px solid #f59e0b" : "1px solid #cbd5e1",
        borderRadius: "999px",
        color: favorited ? "#92400e" : "#475569",
        cursor: pending ? "wait" : "pointer",
        display: "inline-flex",
        font: "inherit",
        fontSize: "12px",
        fontWeight: 700,
        gap: "4px",
        padding: "6px 12px",
      }}
    >
      <span aria-hidden="true">{favorited ? "★" : "☆"}</span>
      {favorited ? "已收藏" : "收藏文章"}
    </button>
  );
}
