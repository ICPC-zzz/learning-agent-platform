"use client";

import { useCallback, useEffect, useState } from "react";

export interface ReaderRecentChapter {
  bookId: string;
  chapterId: string;
  bookTitle?: string | null;
  chapterTitle?: string | null;
  href: string;
  visitedAt: string;
}

export interface ReaderRecentChaptersPanelProps {
  bookId?: string | null;
  chapterId?: string | null;
  bookTitle?: string | null;
  chapterTitle?: string | null;
}

const STORAGE_KEY = "learning-agent-platform:reader-recent-chapters";
const MAX_RECORDS = 10;

function readRecentChapters(): ReaderRecentChapter[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidRecentChapter);
  } catch {
    return [];
  }
}

function isValidRecentChapter(item: unknown): item is ReaderRecentChapter {
  if (item === null || typeof item !== "object") return false;
  const record = item as Record<string, unknown>;
  return (
    typeof record.bookId === "string" &&
    record.bookId.length > 0 &&
    typeof record.chapterId === "string" &&
    record.chapterId.length > 0 &&
    typeof record.href === "string" &&
    record.href.length > 0 &&
    typeof record.visitedAt === "string" &&
    record.visitedAt.length > 0
  );
}

function writeRecentChapters(chapters: ReaderRecentChapter[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chapters));
  } catch {
    // localStorage may be full or unavailable — silently ignore.
  }
}

function clearRecentChapters(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silently ignore.
  }
}

function recordVisit(
  chapters: ReaderRecentChapter[],
  entry: {
    bookId: string;
    chapterId: string;
    bookTitle?: string | null;
    chapterTitle?: string | null;
  },
): ReaderRecentChapter[] {
  const href = `/reader?bookId=${encodeURIComponent(entry.bookId)}&chapterId=${encodeURIComponent(entry.chapterId)}`;
  const visitedAt = new Date().toISOString();

  const newRecord: ReaderRecentChapter = {
    bookId: entry.bookId,
    chapterId: entry.chapterId,
    bookTitle: entry.bookTitle ?? null,
    chapterTitle: entry.chapterTitle ?? null,
    href,
    visitedAt,
  };

  // Remove duplicate (same bookId + chapterId) if exists
  const deduped = chapters.filter(
    (c) => !(c.bookId === entry.bookId && c.chapterId === entry.chapterId),
  );

  // Prepend new record, trim to MAX_RECORDS
  return [newRecord, ...deduped].slice(0, MAX_RECORDS);
}

export function ReaderRecentChaptersPanel({
  bookId,
  chapterId,
  bookTitle,
  chapterTitle,
}: ReaderRecentChaptersPanelProps) {
  const [chapters, setChapters] = useState<ReaderRecentChapter[]>([]);

  // Mount: read existing records
  useEffect(() => {
    setChapters(readRecentChapters());
  }, []);

  // Record current chapter visit when bookId + chapterId are valid
  useEffect(() => {
    if (!bookId || !chapterId) return;

    setChapters((prev) => {
      const updated = recordVisit(prev, {
        bookId,
        chapterId,
        bookTitle,
        chapterTitle,
      });
      writeRecentChapters(updated);
      return updated;
    });
  }, [bookId, chapterId, bookTitle, chapterTitle]);

  const handleClear = useCallback(() => {
    clearRecentChapters();
    setChapters([]);
  }, []);

  // Don't render if no book/chapter context
  if (!bookId && !chapterId && chapters.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="最近访问章节"
      className="readerRecentChapters"
    >
      <h3 className="readerRecentChaptersTitle">最近访问章节</h3>
      <p className="readerRecentChaptersDisclaimer">
        开发预览 · 仅保存在当前浏览器，不写入数据库。
      </p>

      {chapters.length === 0 ? (
        <p className="readerRecentChaptersEmpty">
          暂无最近访问记录。打开章节后会自动记录到当前浏览器。
        </p>
      ) : (
        <ol className="readerRecentChaptersList">
          {chapters.map((record, index) => {
            const isCurrent =
              bookId != null &&
              chapterId != null &&
              record.bookId === bookId &&
              record.chapterId === chapterId;
            const displayTitle =
              record.chapterTitle ?? `章节 ${record.chapterId}`;
            const displayBook = record.bookTitle ?? "未知书籍";

            return (
              <li
                key={`${record.bookId}:${record.chapterId}:${index}`}
                className={`readerRecentChapterItem${isCurrent ? " readerRecentChapterItemCurrent" : ""}`}
              >
                <a
                  className="readerRecentChapterLink"
                  href={record.href}
                >
                  <span className="readerRecentChapterBookTitle">
                    {displayBook}
                  </span>
                  <span className="readerRecentChapterChapterTitle">
                    {displayTitle}
                  </span>
                </a>
                {isCurrent && (
                  <span className="readerRecentChapterCurrentBadge">当前</span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {chapters.length > 0 && (
        <button
          className="readerRecentChaptersClearBtn"
          onClick={handleClear}
          type="button"
        >
          清空本地记录
        </button>
      )}
    </section>
  );
}
