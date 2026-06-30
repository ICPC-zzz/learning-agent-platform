"use client";

import Link from "next/link";
import type { RecentReadingPageView, RecentReadingPageItemView } from "./recent-reading-page-view-model";

interface RecentReadingPageClientProps {
  pageView: RecentReadingPageView;
  dbProgressEnabled: boolean;
}

export function RecentReadingPageClient({
  pageView,
}: RecentReadingPageClientProps) {
  const displayItems = buildDisplayItems(pageView);

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

function buildDisplayItems(
  pageView: RecentReadingPageView,
): RecentReadingPageItemView[] {
  return pageView.dbProgressEnabled ? pageView.items : [];
}
