"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  loadFavorites,
  persistFavorites,
  removeFavorite,
  type FavoriteBookEntry,
} from "../../../../lib/local-user-library-store";
import {
  toggleFavoriteDbAction,
} from "../../../favorites-db-server-action";
import type { FavoriteBooksPageView, FavoriteBooksPageItemView } from "./favorite-books-page-view-model";
import type { FavoritesDbStatusForUi } from "../../../favorites-db-guard";

interface FavoriteBooksPageClientProps {
  pageView: FavoriteBooksPageView;
  dbFavoritesStatus: FavoritesDbStatusForUi;
}

export function FavoriteBooksPageClient({
  pageView,
  dbFavoritesStatus,
}: FavoriteBooksPageClientProps) {
  const [mounted, setMounted] = useState(false);
  const [localFavorites, setLocalFavorites] = useState<FavoriteBookEntry[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    setLocalFavorites(loadFavorites());
    setMounted(true);
  }, []);

  // Build display items: DB-first, localStorage fallback
  const displayItems = buildDisplayItems(
    pageView,
    localFavorites,
    dbFavoritesStatus.enabled,
  );

  const handleUnfavorite = useCallback(
    async (item: FavoriteBooksPageItemView) => {
      setRemovingId(item.bookId);

      if (item.unfavoriteTarget === "db" && dbFavoritesStatus.enabled) {
        // Remove DB favorite + local fallback
        const updated = removeFavorite(localFavorites, item.bookId);
        persistFavorites(updated);
        setLocalFavorites(updated);

        try {
          await toggleFavoriteDbAction(
            item.bookId,
            item.title,
            item.sourceType,
            item.firstChapterId,
            true, // currently favorited
          );
        } catch {
          // Best-effort — localStorage already updated
        }
      } else {
        // Remove localStorage favorite
        const updated = removeFavorite(localFavorites, item.bookId);
        persistFavorites(updated);
        setLocalFavorites(updated);
      }

      setRemovingId(null);
    },
    [localFavorites, dbFavoritesStatus.enabled],
  );

  if (!mounted) {
    return (
      <section className="learningPanel" aria-labelledby="fav-list-title">
        <div className="panelHeader">
          <h2 id="fav-list-title">Favorite Books</h2>
        </div>
        <p className="panelNote">Loading...</p>
      </section>
    );
  }

  return (
    <section className="learningPanel" aria-labelledby="fav-list-title">
      <div className="panelHeader">
        <p className="eyebrow">
          {pageView.dataSourceLabel} · {displayItems.length} favorites
        </p>
        <h2 id="fav-list-title">Favorite Books</h2>
        <p className="panelNote">{pageView.dataSourceNotice}</p>
      </div>

      {displayItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>{pageView.emptyMessage}</strong>
          <p>{pageView.emptySubMessage}</p>
          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link className="primaryLink" href="/books">
              Browse Books
            </Link>
            {!pageView.hasSession ? (
              <Link className="secondaryLink" href={pageView.loginUrl}>
                Dev Login
              </Link>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="chunkList">
          {displayItems.map((item) => (
            <article className="chunkItem" key={item.bookId}>
              <div className="panelHeaderRow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow">
                    {item.sourceType} ·{" "}
                    <span
                      style={{
                        color: item.badge === "db-favorite" ? "#2563eb" : "#92400e",
                      }}
                    >
                      {item.badgeText}
                    </span>
                  </p>
                  <h3 style={{ margin: "4px 0" }}>{item.title}</h3>
                  <p className="panelNote" style={{ margin: 0 }}>
                    Favorited at {item.favoriteTime}
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
                  <Link className="primaryLink" href={item.detailUrl}>
                    Details
                  </Link>
                  {item.readUrl ? (
                    <Link
                      className="secondaryLink"
                      href={item.readUrl}
                      style={{ fontSize: "13px" }}
                    >
                      Read
                    </Link>
                  ) : null}
                  <button
                    onClick={() => handleUnfavorite(item)}
                    disabled={removingId === item.bookId}
                    style={{
                      background: "transparent",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      color: removingId === item.bookId ? "#9ca3af" : "#ef4444",
                      cursor: removingId === item.bookId ? "not-allowed" : "pointer",
                      font: "inherit",
                      fontSize: "12px",
                      padding: "3px 10px",
                    }}
                  >
                    {removingId === item.bookId ? "Removing..." : item.unfavoriteLabel}
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

/**
 * Build display items by merging server-side DB favorites with
 * client-side localStorage favorites when DB is not active.
 */
function buildDisplayItems(
  pageView: FavoriteBooksPageView,
  localFavorites: FavoriteBookEntry[],
  dbEnabled: boolean,
): FavoriteBooksPageItemView[] {
  if (pageView.items.length > 0 && pageView.dbFavoritesEnabled) {
    return pageView.items;
  }

  // Fallback: map localStorage entries to page items
  return localFavorites.map((fav) => ({
    bookId: fav.bookId,
    title: fav.title,
    sourceType: fav.sourceType,
    firstChapterId: fav.firstChapterId ?? null,
    favoriteTime: fav.updatedAt,
    badge: "local-fallback" as const,
    badgeText: "本地收藏 fallback",
    detailUrl: `/books/${encodeURIComponent(fav.bookId)}`,
    readUrl: fav.firstChapterId
      ? `/reader?bookId=${encodeURIComponent(fav.bookId)}&chapterId=${encodeURIComponent(fav.firstChapterId)}`
      : null,
    unfavoriteLabel: "取消收藏（本地）",
    unfavoriteTarget: "local" as const,
  }));
}
