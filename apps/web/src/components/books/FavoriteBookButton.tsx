"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addFavorite,
  isFavorite,
  loadFavorites,
  persistFavorites,
  removeFavorite,
  type FavoriteBookEntry,
} from "../../lib/local-user-library-store";
import {
  toggleFavoriteDbAction,
  checkFavoriteDbAction,
} from "../../app/user/favorites-db-server-action";

interface FavoriteBookButtonProps {
  bookId: string;
  title: string;
  sourceType?: string;
  firstChapterId?: string;
  /** Whether DB favorites guard is enabled for this session. */
  dbFavoritesEnabled?: boolean;
  /** Dev session owner ID — only used when dbFavoritesEnabled is true. */
  devSessionOwnerId?: string | null;
}

export function FavoriteBookButton({
  bookId,
  title,
  sourceType,
  firstChapterId,
  dbFavoritesEnabled = false,
  devSessionOwnerId = null,
}: FavoriteBookButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [dbChecked, setDbChecked] = useState(false);

  // Decide source label
  const sourceLabel = dbFavoritesEnabled && devSessionOwnerId
    ? "开发 DB 收藏"
    : "本地收藏";

  const tooltipText = dbFavoritesEnabled && devSessionOwnerId
    ? "开发 DB 收藏 · dev-only · 绑定 dev session"
    : "本地开发收藏 · 未接真实账号";

  const tooltipSub = dbFavoritesEnabled && devSessionOwnerId
    ? "未同步生产账号"
    : "未同步数据库";

  // Load initial state from localStorage AND DB on mount
  useEffect(() => {
    const favs = loadFavorites();
    setFavorited(isFavorite(favs, bookId));
    setMounted(true);

    // Also check DB status
    if (dbFavoritesEnabled && devSessionOwnerId) {
      checkFavoriteDbAction(bookId).then((result) => {
        if (result.success && result.isFavorite) {
          setFavorited(true);
          // Sync to localStorage if DB says favorited but localStorage doesn't
          if (!isFavorite(favs, bookId)) {
            const entry: FavoriteBookEntry = {
              bookId,
              title,
              sourceType: sourceType ?? "未知来源",
              firstChapterId,
              updatedAt: new Date().toISOString(),
            };
            const updated = addFavorite(favs, entry);
            persistFavorites(updated);
          }
        }
        setDbChecked(true);
      }).catch(() => {
        setDbChecked(true);
      });
    } else {
      setDbChecked(true);
    }
  }, [bookId, title, sourceType, firstChapterId, dbFavoritesEnabled, devSessionOwnerId]);

  const toggle = useCallback(() => {
    // Always update localStorage first (optimistic)
    const favs = loadFavorites();

    if (favorited) {
      const updated = removeFavorite(favs, bookId);
      persistFavorites(updated);
      setFavorited(false);
    } else {
      const entry: FavoriteBookEntry = {
        bookId,
        title,
        sourceType: sourceType ?? "未知来源",
        firstChapterId,
        updatedAt: new Date().toISOString(),
      };
      const updated = addFavorite(favs, entry);
      persistFavorites(updated);
      setFavorited(true);
    }

    // Also call DB action if enabled
    if (dbFavoritesEnabled && devSessionOwnerId) {
      toggleFavoriteDbAction(
        bookId,
        title,
        sourceType ?? "未知来源",
        firstChapterId ?? null,
        favorited, // current state (before toggle)
      ).catch(() => {
        // DB action failed — localStorage already updated, that's fine
      });
    }
  }, [bookId, title, sourceType, firstChapterId, favorited, dbFavoritesEnabled, devSessionOwnerId]);

  // Don't render until client hydration to avoid mismatch
  if (!mounted) {
    return null;
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={toggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{
          alignItems: "center",
          background: favorited ? "#fef3c7" : "#f8fafc",
          border: favorited ? "1px solid #f59e0b" : "1px solid #cbd5e1",
          borderRadius: "8px",
          color: favorited ? "#92400e" : "#475569",
          cursor: "pointer",
          display: "inline-flex",
          font: "inherit",
          fontSize: "13px",
          fontWeight: 600,
          gap: "4px",
          padding: "6px 14px",
          transition: "background 0.15s, border-color 0.15s, color 0.15s",
        }}
        aria-label={favorited ? `取消收藏 ${title}` : `收藏 ${title}`}
        title={sourceLabel}
      >
        <span aria-hidden="true">{favorited ? "★" : "☆"}</span>
        {favorited ? "已收藏" : sourceLabel}
      </button>
      {showTooltip ? (
        <div
          style={{
            background: "#1e293b",
            borderRadius: "6px",
            color: "#f1f5f9",
            fontSize: "11px",
            left: "50%",
            lineHeight: "1.4",
            padding: "6px 10px",
            pointerEvents: "none",
            position: "absolute",
            top: "calc(100% + 6px)",
            transform: "translateX(-50%)",
            whiteSpace: "nowrap",
            zIndex: 100,
          }}
          role="tooltip"
        >
          {tooltipText}
          <br />
          {tooltipSub}
        </div>
      ) : null}
    </div>
  );
}
