"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  loadFavorites,
  persistFavorites,
  removeFavorite,
  getSessionAwareLabels,
  type FavoriteBookEntry,
} from "../../lib/local-user-library-store";
import { EMPTY_STATE_MESSAGES } from "../../app/user/user-dashboard-types";
import type { DbFavoriteBookView } from "../../app/user/favorites-db-view-model";

interface UserFavoriteBooksPanelProps {
  hasSession?: boolean;
  /** DB favorites data when guard is enabled */
  dbFavorites?: DbFavoriteBookView[] | null;
  /** Whether DB favorites guard is enabled */
  dbFavoritesEnabled?: boolean;
  /** Message from DB loader */
  dbFavoritesMessage?: string | null;
}

export function UserFavoriteBooksPanel({
  hasSession = false,
  dbFavorites = null,
  dbFavoritesEnabled = false,
  dbFavoritesMessage = null,
}: UserFavoriteBooksPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteBookEntry[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
    setMounted(true);
  }, []);

  const handleRemove = (bookId: string) => {
    const updated = removeFavorite(favorites, bookId);
    persistFavorites(updated);
    setFavorites(updated);
  };

  const labels = getSessionAwareLabels(hasSession ? "dev-session" : "no-session");

  // Determine data source
  const useDbFavorites = dbFavoritesEnabled && dbFavorites !== null && dbFavorites.length > 0;
  const displayItems = useDbFavorites ? dbFavorites : favorites;
  const sourceBadge = useDbFavorites ? "开发 DB 收藏" : "本地收藏 fallback";
  const sourceNotice = useDbFavorites
    ? `开发 DB 收藏（dev-only）· 绑定 dev session 用户 · 未接生产同步`
    : labels.localDataNotice;

  if (!mounted) {
    return (
      <section className="learningPanel" aria-labelledby="fav-books-title">
        <div className="panelHeader">
          <p className="eyebrow">Favorites</p>
          <h2 id="fav-books-title">{labels.favoritesLabel}</h2>
        </div>
        <p className="panelNote">Loading...</p>
      </section>
    );
  }

  return (
    <section className="learningPanel" aria-labelledby="fav-books-title">
      <div className="panelHeader">
        <p className="eyebrow">Favorites</p>
        <h2 id="fav-books-title">
          {useDbFavorites ? "开发 DB 收藏书籍（dev-only）" : labels.favoritesLabel}
        </h2>
        <p className="panelNote">
          {dbFavoritesMessage ?? sourceNotice}
        </p>
      </div>

      {displayItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>{EMPTY_STATE_MESSAGES.favoriteBooks}</strong>
          <p>
            Go to{" "}
            <Link className="secondaryLink" href="/books" style={{ fontSize: "inherit" }}>
              Books
            </Link>{" "}
            and click the favorite button to add books.
          </p>
          <p style={{ color: "#64748b", fontSize: "11px", marginTop: "8px" }}>
            {dbFavoritesEnabled
              ? "DB 收藏已启用但当前无收藏记录。使用收藏按钮添加。"
              : "Favorites saved in browser localStorage only, not connected to database."}
          </p>
        </div>
      ) : (
        <>
          <p className="panelNote" style={{ marginBottom: "14px" }}>
            {displayItems.length} favorites · {sourceBadge}
          </p>
          <div className="chunkList">
            {displayItems.map((fav) => {
              // Check if it's a DB favorite or localStorage entry
              const isDbFav = "source" in fav && fav.source === "db-favorite";
              const dbFav = isDbFav ? fav as DbFavoriteBookView : null;
              const localFav = !isDbFav ? fav as FavoriteBookEntry : null;

              const bookId = dbFav?.bookId ?? localFav?.bookId ?? "";
              const title = dbFav?.bookTitle ?? localFav?.title ?? "";
              const sourceType = dbFav?.sourceType ?? localFav?.sourceType ?? "";
              const firstChapterId = dbFav?.firstChapterId ?? localFav?.firstChapterId;
              const timeLabel = dbFav?.createdAt ?? localFav?.updatedAt ?? "";
              const badge = isDbFav ? "开发 DB 收藏" : "本地收藏 fallback";

              return (
                <article className="chunkItem" key={bookId}>
                  <div className="panelHeaderRow">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="eyebrow">{sourceType} · {badge}</p>
                      <h3 style={{ margin: "4px 0" }}>{title}</h3>
                      <p className="panelNote" style={{ margin: 0 }}>
                        Favorited at {timeLabel}
                      </p>
                    </div>
                    <div
                      className="homeActions"
                      style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: "6px" }}
                    >
                      <Link
                        className="primaryLink"
                        href={`/books/${encodeURIComponent(bookId)}`}
                      >
                        Details
                      </Link>
                      {firstChapterId !== undefined ? (
                        <Link
                          className="secondaryLink"
                          href={`/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(firstChapterId)}`}
                          style={{ fontSize: "13px" }}
                        >
                          Read
                        </Link>
                      ) : null}
                      <button
                        onClick={() => {
                          if (isDbFav) {
                            // For DB favorites, also remove from localStorage
                            handleRemove(bookId);
                          } else {
                            handleRemove(bookId);
                          }
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
                        Unfavorite
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
