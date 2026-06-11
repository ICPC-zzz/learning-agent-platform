"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addFavoriteProblem,
  isFavoriteProblem,
  loadFavorites,
  persistFavorites,
  removeFavoriteProblem,
  type FavoriteProblemEntry,
} from "../lib/local-user-problem-store";

interface FavoriteProblemButtonProps {
  problemId: string;
  title: string;
  difficulty: string;
  tags?: string[];
  /** Whether DB favorites guard is enabled for this session. */
  dbFavoritesEnabled?: boolean;
  /** Dev session owner ID — only used when dbFavoritesEnabled is true. */
  devSessionOwnerId?: string | null;
}

export function FavoriteProblemButton({
  problemId,
  title,
  difficulty,
  tags = [],
  dbFavoritesEnabled = false,
  devSessionOwnerId = null,
}: FavoriteProblemButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

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

  // Load initial state from localStorage on mount
  useEffect(() => {
    const favs = loadFavorites();
    setFavorited(isFavoriteProblem(favs, problemId));
    setMounted(true);
  }, [problemId]);

  const toggle = useCallback(() => {
    const favs = loadFavorites();

    if (favorited) {
      const updated = removeFavoriteProblem(favs, problemId);
      persistFavorites(updated);
      setFavorited(false);
    } else {
      const entry: FavoriteProblemEntry = {
        problemId,
        title,
        difficulty,
        tags,
        favoritedAt: new Date().toISOString(),
      };
      const updated = addFavoriteProblem(favs, entry);
      persistFavorites(updated);
      setFavorited(true);
    }
    // DB action would go here when implemented
  }, [problemId, title, difficulty, tags, favorited, dbFavoritesEnabled, devSessionOwnerId]);

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
