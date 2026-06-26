/**
 * Pure filter functions for the Book Library page.
 *
 * All functions are synchronous, pure, and do NOT:
 * - Connect to a database or repository
 * - Make network requests
 * - Access filesystem
 * - Call any LLM or provider
 */

import type { BookLibraryItemView } from "./book-library-types";

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

export interface BookLibraryFilterInput {
  searchQuery?: string;
  tagFilter?: string;
  difficultyFilter?: string;
  categoryFilter?: string;
}

export interface BookLibraryFilterResult {
  books: BookLibraryItemView[];
  hasActiveFilters: boolean;
  totalBefore: number;
  totalAfter: number;
}

// ---------------------------------------------------------------------------
// Filter
// ---------------------------------------------------------------------------

export function filterBooks(
  books: BookLibraryItemView[],
  input: BookLibraryFilterInput,
): BookLibraryFilterResult {
  const q = (input.searchQuery ?? "").trim().toLocaleLowerCase();
  const tag = (input.tagFilter ?? "").trim().toLocaleLowerCase();
  const diff = (input.difficultyFilter ?? "").trim().toLocaleLowerCase();
  const category = (input.categoryFilter ?? "").trim().toLocaleLowerCase();

  const active = q.length > 0 || tag.length > 0 || diff.length > 0 || category.length > 0;
  if (!active) {
    return {
      books: [...books],
      hasActiveFilters: false,
      totalBefore: books.length,
      totalAfter: books.length,
    };
  }

  const filtered = books.filter((book) => {
    const matchSearch = q.length === 0 || [
      book.title ?? "",
      book.summary ?? "",
      book.author ?? "",
      (book.tags ?? []).join(" "),
      book.difficulty ?? "",
    ].some((f) => f.trim().toLocaleLowerCase().includes(q));

    const matchTag = tag.length === 0 ||
      (book.tags ?? []).some((t) => t.trim().toLocaleLowerCase() === tag);

    const matchDiff = diff.length === 0 ||
      (book.difficulty ?? "").trim().toLocaleLowerCase() === diff;
    const matchCategory = category.length === 0 ||
      (book.category ?? "").trim().toLocaleLowerCase() === category;

    return matchSearch && matchTag && matchDiff && matchCategory;
  });

  return {
    books: filtered,
    hasActiveFilters: true,
    totalBefore: books.length,
    totalAfter: filtered.length,
  };
}

// ---------------------------------------------------------------------------
// Collect metadata
// ---------------------------------------------------------------------------

export function collectTags(books: BookLibraryItemView[]): string[] {
  const s = new Set<string>();
  for (const b of books) {
    for (const t of b.tags ?? []) {
      const trimmed = t.trim();
      if (trimmed.length > 0) s.add(trimmed);
    }
  }
  return Array.from(s).sort((a, b) =>
    a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()),
  );
}

export function collectDifficulties(books: BookLibraryItemView[]): string[] {
  const s = new Set<string>();
  for (const b of books) {
    const d = (b.difficulty ?? "").trim();
    if (d.length > 0) s.add(d);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

export function collectCategories(books: BookLibraryItemView[]): string[] {
  const s = new Set<string>();
  for (const b of books) {
    const category = (b.category ?? "").trim();
    if (category.length > 0) s.add(category);
  }
  return Array.from(s).sort((a, b) => a.localeCompare(b));
}

export function getDefinedCategories(): string[] {
  return [
    "Python",
    "JavaScript",
    "Algorithm",
    "Data Structures",
    "Database",
    "Web Dev",
    "Machine Learning",
    "System Design",
    "Java",
    "Go",
    "Rust",
    "C/C++",
    "Linux",
    "Security",
    "Testing",
    "DevOps",
  ];
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface BookLibraryStats {
  bookCount: number;
  chapterCount: number;
}

export function computeBookStats(books: BookLibraryItemView[]): BookLibraryStats {
  let chapters = 0;
  for (const b of books) {
    if (b.chapterCount !== undefined && b.chapterCount > 0) {
      chapters += b.chapterCount;
    }
  }
  return { bookCount: books.length, chapterCount: chapters };
}

// ---------------------------------------------------------------------------
// Empty state message
// ---------------------------------------------------------------------------

export function getEmptyFilterMessage(active: boolean): string {
  if (active) {
    return "No matching books found. Adjust search, tags, or difficulty filter.";
  }
  return "No books available.";
}
