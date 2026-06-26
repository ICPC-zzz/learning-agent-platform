"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRecentReadings,
  loadRecentReadings,
  getSessionAwareLabels,
  type RecentReadingEntry,
} from "../../lib/local-user-library-store";
import { EMPTY_STATE_MESSAGES } from "../../app/user/user-dashboard-types";

interface UserRecentReadingPanelProps {
  hasSession?: boolean;
}

export function UserRecentReadingPanel({ hasSession = false }: UserRecentReadingPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<RecentReadingEntry[]>([]);

  useEffect(() => {
    const all = loadRecentReadings();
    setEntries(getRecentReadings(all, 10));
    setMounted(true);
  }, []);

  const labels = getSessionAwareLabels(hasSession ? "dev-session" : "no-session");

  if (!mounted) {
    return (
      <section className="learningPanel" aria-labelledby="recent-reading-title">
        <div className="panelHeader">
          <p className="eyebrow">Reading</p>
          <h2 id="recent-reading-title">{labels.recentReadingLabel}</h2>
        </div>
        <p className="panelNote">Loading...</p>
      </section>
    );
  }

  return (
    <section className="learningPanel" aria-labelledby="recent-reading-title">
      <div className="panelHeader">
        <p className="eyebrow">Reading</p>
        <h2 id="recent-reading-title">{labels.recentReadingLabel}</h2>
        <p className="panelNote">{labels.localDataNotice}</p>
      </div>

      {entries.length === 0 ? (
        <div className="learningEmptyState" aria-live="polite">
          <strong>{EMPTY_STATE_MESSAGES.recentReading}</strong>
          <p>
            Go to{" "}
            <Link className="secondaryLink" href="/books" style={{ fontSize: "inherit" }}>
              Books
            </Link>{" "}
            and open a book in the reader. Click "Record Recent Reading" to see entries here.
          </p>
          <p style={{ color: "#64748b", fontSize: "11px", marginTop: "8px" }}>
            Recent reading records saved in browser localStorage only, not connected to database.
          </p>
        </div>
      ) : (
        <>
          <p className="panelNote" style={{ marginBottom: "14px" }}>
            {entries.length} recent reading entries . local dev preview
          </p>
          <div className="chunkList">
            {entries.map((entry, idx) => (
              <article className="chunkItem" key={`${entry.bookId}-${entry.chapterId}-${idx}`}>
                <div className="panelHeaderRow">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="eyebrow">{entry.sourceType}</p>
                    <h3 style={{ margin: "4px 0" }}>{entry.bookTitle}</h3>
                    <p className="panelNote" style={{ margin: 0 }}>
                      {entry.chapterTitle} . Read at {entry.lastReadAt}
                    </p>
                  </div>
                  <div className="homeActions" style={{ alignItems: "flex-end", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <Link
                      className="primaryLink"
                      href={`/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`}
                    >
                      Continue Reading
                    </Link>
                    <Link
                      className="secondaryLink"
                      href={`/books/${encodeURIComponent(entry.bookId)}`}
                      style={{ fontSize: "13px" }}
                    >
                      Details
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
