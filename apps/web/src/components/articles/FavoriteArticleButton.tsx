"use client";

import { useCallback, useEffect, useState } from "react";

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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    checkArticleFavoriteDbAction(articleId)
      .then((result) => {
        if (result.success) {
          setFavorited(result.isFavorite);
        }
      })
      .catch(() => {
        setStatusMessage("收藏状态读取失败，请稍后刷新。");
      });
  }, [articleId]);

  const toggle = useCallback(async () => {
    if (pending) return;

    setPending(true);
    setStatusMessage(null);
    try {
      const result = await toggleArticleFavoriteDbAction(
        articleId,
        title,
        sourcePlatform,
        sourceName,
        originalUrl,
        favorited,
      );
      if (result.success) {
        setFavorited(result.isFavorite);
        setStatusMessage(result.uiMessage);
      } else {
        setStatusMessage(result.uiMessage || "请先登录后再收藏文章。");
      }
    } catch {
      setStatusMessage("收藏操作失败，请稍后再试。");
    } finally {
      setPending(false);
    }
  }, [articleId, favorited, originalUrl, pending, sourceName, sourcePlatform, title]);

  if (!mounted) {
    return null;
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
      <button
        className="lap-favorite-article-button"
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
          flexShrink: 0,
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
      {statusMessage ? (
        <span style={{ maxWidth: "180px", color: "#64748b", fontSize: "11px", lineHeight: 1.35 }} role="status">
          {statusMessage}
        </span>
      ) : null}
    </span>
  );
}
