"use client";

import { useMemo, useState } from "react";

import type { BookLibraryItemView } from "../book-library-types";
import { BookLibraryItem } from "./BookLibraryItem";

interface BookLibraryListProps {
  books: BookLibraryItemView[];
  /** Whether DB favorites guard is enabled for this session. */
  dbFavoritesEnabled?: boolean;
  /** Dev session owner ID. */
  devSessionOwnerId?: string | null;
}

export function BookLibraryList({ books, dbFavoritesEnabled = false, devSessionOwnerId = null }: BookLibraryListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const availableLanguages = useMemo(() => getAvailableLanguages(books), [books]);
  const filteredBooks = useMemo(
    () => filterBooks(books, searchQuery, languageFilter),
    [books, searchQuery, languageFilter],
  );
  const trimmedSearchQuery = searchQuery.trim();
  const hasActiveFilters =
    trimmedSearchQuery.length > 0 || languageFilter.length > 0;
  const resultSummary = hasActiveFilters
    ? `正在显示 ${books.length} 本开发数据源或演示书籍中的 ${filteredBooks.length} 本。`
    : `正在显示全部 ${books.length} 本开发数据源或演示书籍。`;

  return (
    <section className="learningPanel" aria-labelledby="book-library-list-title">
      <div className="panelHeader">
        <p className="eyebrow">书籍入口预览</p>
        <h2 id="book-library-list-title">开发数据源与演示书籍列表</h2>
        <p className="panelNote">
          此列表只读展示书籍元数据，不加载原始章节或 chunk 全文，也不触发导入、AI 解析或 RAG。
        </p>
      </div>

      <dl
        aria-label="书库筛选器"
        className="scoreMeta"
        style={{ marginTop: "18px" }}
      >
        <div>
          <dt>
            <label htmlFor="book-library-search">搜索标题或作者</label>
          </dt>
          <dd>
            <input
              aria-label="按标题或作者搜索书籍"
              id="book-library-search"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="搜索书籍预览入口"
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                font: "inherit",
                minHeight: "38px",
                padding: "8px 10px",
                width: "100%",
              }}
              type="search"
              value={searchQuery}
            />
          </dd>
        </div>
        {availableLanguages.length > 0 ? (
          <div>
            <dt>
              <label htmlFor="book-library-language">语言</label>
            </dt>
            <dd>
              <select
                aria-label="按语言筛选书籍"
                id="book-library-language"
                onChange={(event) => setLanguageFilter(event.target.value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: "8px",
                  font: "inherit",
                  minHeight: "38px",
                  padding: "8px 10px",
                  width: "100%",
                }}
                value={languageFilter}
              >
                <option value="">全部语言</option>
                {availableLanguages.map((language) => (
                  <option key={language} value={language}>
                    {language}
                  </option>
                ))}
              </select>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>结果</dt>
          <dd>{resultSummary}</dd>
        </div>
      </dl>

      <div className="chunkList" style={{ marginTop: "18px" }}>
        {filteredBooks.length > 0 ? (
          filteredBooks.map((book) => (
            <BookLibraryItem book={book} key={book.id} dbFavoritesEnabled={dbFavoritesEnabled} devSessionOwnerId={devSessionOwnerId} />
          ))
        ) : (
          <div className="learningEmptyState" aria-live="polite">
            <strong>没有书籍预览入口匹配当前筛选条件。</strong>
            <p>
              清空搜索文本或语言筛选，即可重新显示当前开发数据源或演示 fallback 列表。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function filterBooks(
  books: BookLibraryItemView[],
  searchQuery: string,
  languageFilter: string,
): BookLibraryItemView[] {
  const normalizedQuery = normalizeSearchText(searchQuery);
  const normalizedLanguageFilter = normalizeSearchText(languageFilter);

  return books.filter((book) => {
    const matchesText =
      normalizedQuery.length === 0 ||
      normalizeSearchText(book.title).includes(normalizedQuery) ||
      normalizeSearchText(book.author).includes(normalizedQuery);
    const matchesLanguage =
      normalizedLanguageFilter.length === 0 ||
      normalizeSearchText(book.language) === normalizedLanguageFilter;

    return matchesText && matchesLanguage;
  });
}

function getAvailableLanguages(books: BookLibraryItemView[]): string[] {
  const languages = new Set<string>();

  for (const book of books) {
    const language = book.language?.trim();

    if (language !== undefined && language.length > 0) {
      languages.add(language);
    }
  }

  return Array.from(languages).sort((first, second) =>
    first.localeCompare(second),
  );
}

function normalizeSearchText(value: string | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase();
}
