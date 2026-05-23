"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────

export interface ReaderBookmark {
  id: string;
  bookId: string;
  chapterId: string;
  bookTitle?: string | null;
  chapterTitle?: string | null;
  href: string;
  scrollPercent: number;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReaderBookmarksPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

// ── Constants ───────────────────────────────────────────────────────────

const STORAGE_KEY = "learning-agent-platform.reader.bookmarks.v1";
const MAX_BOOKMARKS = 30;

// ── localStorage helpers ────────────────────────────────────────────────

function readAllBookmarks(): ReaderBookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidBookmark);
  } catch {
    return [];
  }
}

function writeAllBookmarks(bookmarks: ReaderBookmark[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function isValidBookmark(item: unknown): item is ReaderBookmark {
  if (item === null || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    typeof record.href === "string" &&
    record.href.length > 0 &&
    typeof record.scrollPercent === "number" &&
    Number.isFinite(record.scrollPercent) &&
    record.scrollPercent >= 0 &&
    record.scrollPercent <= 100 &&
    typeof record.label === "string" &&
    record.label.length > 0 &&
    typeof record.createdAt === "string" &&
    record.createdAt.length > 0 &&
    typeof record.updatedAt === "string" &&
    record.updatedAt.length > 0
  );
}

// ── Scroll position helper ──────────────────────────────────────────────

function getScrollPercent(): number {
  try {
    const doc = document.documentElement;
    const scrollTop = window.scrollY;
    const maxScroll = doc.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    const raw = Math.round((scrollTop / maxScroll) * 100);
    return Math.min(100, Math.max(0, raw));
  } catch {
    return 0;
  }
}

// ── ID generator ─────────────────────────────────────────────────────────

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `bm_${timestamp}_${random}`;
}

// ── Label / Time helpers ─────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  } catch {
    return "—";
  }
}

function buildAutoLabel(scrollPercent: number): string {
  return `第 ${scrollPercent}% 位置`;
}

function buildHref(bookId: string, chapterId: string): string {
  return `/reader?bookId=${encodeURIComponent(bookId)}&chapterId=${encodeURIComponent(chapterId)}`;
}

// ── Component ───────────────────────────────────────────────────────────

export function ReaderBookmarksPanel({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
}: ReaderBookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const confirmClearAllRef = useRef(false);

  // Mount: load from localStorage
  useEffect(() => {
    setBookmarks(readAllBookmarks());
  }, []);

  // ── Add bookmark ──────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    if (!bookId || !chapterId) return;

    setBookmarks((prev) => {
      if (prev.length >= MAX_BOOKMARKS) return prev;

      const scrollPercent = getScrollPercent();
      const now = new Date().toISOString();
      const href = buildHref(bookId, chapterId);

      const newBookmark: ReaderBookmark = {
        id: generateId(),
        bookId,
        chapterId,
        bookTitle: bookTitle ?? null,
        chapterTitle: chapterTitle ?? null,
        href,
        scrollPercent,
        label: buildAutoLabel(scrollPercent),
        createdAt: now,
        updatedAt: now,
      };

      const updated = [newBookmark, ...prev];
      writeAllBookmarks(updated);
      return updated;
    });
  }, [bookId, chapterId, bookTitle, chapterTitle]);

  // ── Delete single bookmark ────────────────────────────────────────────

  const handleDelete = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const updated = prev.filter((b) => b.id !== id);
        writeAllBookmarks(updated);
        return updated;
      });
    },
    [],
  );

  // ── Clear current chapter ─────────────────────────────────────────────

  const handleClearCurrentChapter = useCallback(() => {
    if (!bookId || !chapterId) return;
    setBookmarks((prev) => {
      const updated = prev.filter(
        (b) => !(b.bookId === bookId && b.chapterId === chapterId),
      );
      writeAllBookmarks(updated);
      return updated;
    });
  }, [bookId, chapterId]);

  // ── Clear all ─────────────────────────────────────────────────────────

  const handleClearAll = useCallback(() => {
    if (!confirmClearAllRef.current) {
      confirmClearAllRef.current = true;
      // Force re-render to show confirm state
      setBookmarks((prev) => [...prev]);
      return;
    }
    confirmClearAllRef.current = false;
    localStorage.removeItem(STORAGE_KEY);
    setBookmarks([]);
  }, []);

  // Reset confirm state when chapter/book changes
  useEffect(() => {
    confirmClearAllRef.current = false;
  }, [bookId, chapterId]);

  // ── Jump to bookmark ──────────────────────────────────────────────────

  const handleJump = useCallback(
    (bookmark: ReaderBookmark, event: React.MouseEvent<HTMLAnchorElement>) => {
      // If same book + same chapter, scroll within current page
      if (
        bookId != null &&
        chapterId != null &&
        bookmark.bookId === bookId &&
        bookmark.chapterId === chapterId
      ) {
        event.preventDefault();
        const doc = document.documentElement;
        const maxScroll = doc.scrollHeight - window.innerHeight;
        if (maxScroll <= 0) return;
        const targetScrollTop = Math.round(
          (bookmark.scrollPercent / 100) * maxScroll,
        );
        window.scrollTo({ top: targetScrollTop, behavior: "smooth" });
      }
      // Otherwise, let the <a> href navigate normally
    },
    [bookId, chapterId],
  );

  // ── Derived data ──────────────────────────────────────────────────────

  const currentChapterBookmarks = bookmarks.filter(
    (b) =>
      bookId != null &&
      chapterId != null &&
      b.bookId === bookId &&
      b.chapterId === chapterId,
  );

  const hasAnyBookmarks = bookmarks.length > 0;
  const isAtMax = bookmarks.length >= MAX_BOOKMARKS;
  const hasCurrentChapter =
    bookId != null && chapterId != null && currentChapterBookmarks.length > 0;

  // ── Render ────────────────────────────────────────────────────────────

  // Don't render if no book/chapter context and no bookmarks at all
  if (!bookId && !chapterId && bookmarks.length === 0) {
    return null;
  }

  return (
    <section aria-label="本地书签" className="readerBookmarks">
      <h3 className="readerBookmarksTitle">本地书签</h3>
      <p className="readerBookmarksDisclaimer">
        开发预览 · 仅保存在当前浏览器，不写入数据库。
      </p>

      {/* Add bookmark button */}
      {bookId && chapterId && (
        <div className="readerBookmarksActions">
          <button
            className="readerBookmarksBtn readerBookmarksBtnAdd"
            disabled={isAtMax}
            onClick={handleAdd}
            type="button"
          >
            {isAtMax ? `已达上限（${MAX_BOOKMARKS} 条）` : "添加当前位置书签"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {!hasAnyBookmarks ? (
        <p className="readerBookmarksEmpty">
          暂无本地书签。点击"添加当前位置书签"后，会把当前阅读位置保存在此浏览器。
        </p>
      ) : (
        <>
          {/* Bookmark list */}
          <ol className="readerBookmarksList">
            {bookmarks.map((bookmark) => {
              const isCurrentChapter =
                bookId != null &&
                chapterId != null &&
                bookmark.bookId === bookId &&
                bookmark.chapterId === chapterId;

              const displayChapterTitle =
                bookmark.chapterTitle ?? `章节 ${bookmark.chapterId}`;
              const displayBookTitle = bookmark.bookTitle ?? "未知书籍";

              return (
                <li
                  key={bookmark.id}
                  className={`readerBookmarksItem${isCurrentChapter ? " readerBookmarksItemCurrent" : ""}`}
                >
                  <a
                    className="readerBookmarksLink"
                    href={bookmark.href}
                    onClick={(e) => handleJump(bookmark, e)}
                  >
                    <span className="readerBookmarksLabel">
                      {bookmark.label}
                    </span>
                    <span className="readerBookmarksChapterTitle">
                      {displayChapterTitle}
                    </span>
                    {displayBookTitle && (
                      <span className="readerBookmarksBookTitle">
                        {displayBookTitle}
                      </span>
                    )}
                    <span className="readerBookmarksMeta">
                      {bookmark.scrollPercent}% ·{" "}
                      {formatTimestamp(bookmark.createdAt)}
                    </span>
                  </a>

                  <div className="readerBookmarksItemActions">
                    {isCurrentChapter && (
                      <span className="readerBookmarksCurrentBadge">
                        当前章节
                      </span>
                    )}
                    <button
                      aria-label={`删除书签：${bookmark.label}`}
                      className="readerBookmarksDeleteBtn"
                      onClick={() => handleDelete(bookmark.id)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Clear actions */}
          <div className="readerBookmarksActions">
            {hasCurrentChapter && (
              <button
                className="readerBookmarksBtn readerBookmarksBtnClearChapter"
                onClick={handleClearCurrentChapter}
                type="button"
              >
                清空当前章节书签
              </button>
            )}
            <button
              className={`readerBookmarksBtn readerBookmarksBtnClearAll${confirmClearAllRef.current ? " readerBookmarksBtnDanger" : ""}`}
              onClick={handleClearAll}
              type="button"
            >
              {confirmClearAllRef.current
                ? "确认清空全部本地书签？此操作不可撤销。"
                : "清空全部本地书签"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
