"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecentReadings,
  loadRecentReadings,
  type RecentReadingEntry,
} from "../../../../lib/local-user-library-store";
import type { RecentReadingPageView, RecentReadingPageItemView } from "./recent-reading-page-view-model";

interface RecentReadingPageClientProps {
  pageView: RecentReadingPageView;
  dbProgressEnabled: boolean;
}

export function RecentReadingPageClient({
  pageView,
  dbProgressEnabled,
}: RecentReadingPageClientProps) {
  const [mounted, setMounted] = useState(false);
  const [localEntries, setLocalEntries] = useState<RecentReadingEntry[]>([]);

  useEffect(() => {
    const all = loadRecentReadings();
    setLocalEntries(getRecentReadings(all, 15));
    setMounted(true);
  }, []);

  // Build display items: DB-first, localStorage fallback
  const displayItems = buildDisplayItems(pageView, localEntries, dbProgressEnabled);

  if (!mounted) {
    return (
      <section className="learningPanel" aria-labelledby="recent-reading-list-title">
        <div className="panelHeader">
          <h2 id="recent-reading-list-title">Recent Reading</h2>
        </div>
        <p className="panelNote">Loading...</p>
      </section>
    );
  }

  return (
    <section className="learningPanel" aria-labelledby="recent-reading-list-title">
      <div className="panelHeader">
        <p className="eyebrow">
          {pageView.dataSourceLabel} · {displayItems.length} entries
        </p>
        <h2 id="recent-reading-list-title">Recent Reading</h2>
        <p className="panelNote">{pageView.dataSourceNotice}</p>
      </div>

      {displayItems.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>{pageView.emptyMessage}</strong>
          <p>{pageView.emptySubMessage}</p>
          <div style={{ marginTop: "14px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <Link className="primaryLink" href="/reader">
              Open Reader
            </Link>
            <Link className="secondaryLink" href="/books">
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
          {displayItems.map((item, idx) => (
            <article
              className="chunkItem"
              key={`${item.bookId}-${idx}`}
            >
              <div className="panelHeaderRow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="eyebrow">
                    <span
                      style={{
                        color: item.badge === "db-progress" ? "#2563eb" : "#92400e",
                      }}
                    >
                      {item.badgeText}
                    </span>
                    {" · "}{item.progressDisplay}
                  </p>
                  <h3 style={{ margin: "4px 0" }}>{item.bookTitle}</h3>
                  <p className="panelNote" style={{ margin: 0 }}>
                    {item.chapterTitle} · Read at {item.updatedAt}
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
                  <Link className="primaryLink" href={item.continueReadingUrl}>
                    Continue Reading
                  </Link>
                  <Link
                    className="secondaryLink"
                    href={item.detailUrl}
                    style={{ fontSize: "13px" }}
                  >
                    Details
                  </Link>
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
 * Build display items: DB-first with localStorage fallback.
 */
function buildDisplayItems(
  pageView: RecentReadingPageView,
  localEntries: RecentReadingEntry[],
  dbProgressEnabled: boolean,
): RecentReadingPageItemView[] {
  if (pageView.items.length > 0 && pageView.dbProgressEnabled) {
    return pageView.items;
  }

  // Fallback: map localStorage entries to page items
  return localEntries.map((entry) => ({
    bookId: entry.bookId,
    bookTitle: entry.bookTitle,
    chapterTitle: entry.chapterTitle,
    progressPercent: 0,
    progressDisplay: "N/A（本地记录）",
    updatedAt: entry.lastReadAt,
    sourceType: entry.sourceType,
    badge: "local-fallback" as const,
    badgeText: "本地最近阅读 fallback",
    continueReadingUrl: `/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`,
    detailUrl: `/books/${encodeURIComponent(entry.bookId)}`,
  }));
}
