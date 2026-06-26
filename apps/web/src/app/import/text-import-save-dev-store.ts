/**
 * In-memory dev book store for text import save.
 *
 * This store lives in the Node.js process heap and is lost on restart.
 * It is NOT connected to any production database, user system, or auth provider.
 *
 * Books saved here are designated "开发内存书库 / 重启丢失 / 未连接生产数据库".
 *
 * @module text-import-save-dev-store
 * @previewOnly — dev/test-only, production disabled by default
 */

export interface DevBookRecord {
  id: string;
  title: string;
  author: string | null;
  sourceType: string;
  description: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DevChapterRecord {
  id: string;
  bookId: string;
  title: string;
  orderIndex: number;
  level: number;
  plainText: string;
}

export interface DevChunkRecord {
  id: string;
  bookId: string;
  chapterId: string;
  orderIndex: number;
  plainText: string;
}

export interface DevBookData {
  book: DevBookRecord;
  chapters: DevChapterRecord[];
  chunks: DevChunkRecord[];
}

/**
 * Process‑level in‑memory store.
 * All data is lost on server restart.
 */
const devBooksById = new Map<string, DevBookData>();

/** Simple monotonic counter for generating unique IDs. */
let devIdCounter = 1;

function nextDevId(): number {
  const id = devIdCounter;
  devIdCounter += 1;
  return id;
}

export function saveDevBook(data: DevBookData): void {
  devBooksById.set(data.book.id, data);
}

export function getDevBook(bookId: string): DevBookData | null {
  return devBooksById.get(bookId) ?? null;
}

export function listDevBooks(): DevBookData[] {
  return Array.from(devBooksById.values());
}

export function getDevBookCount(): number {
  return devBooksById.size;
}

/**
 * Generate a unique dev book ID.
 * Format: "dev-import-{counter}"
 */
export function generateDevBookId(): string {
  return `dev-import-${nextDevId()}`;
}

/**
 * Generate a dev chapter ID scoped to a book.
 */
export function generateDevChapterId(bookId: string, orderIndex: number): string {
  return `${bookId}-ch-${orderIndex}`;
}

/**
 * Generate a dev chunk ID scoped to a chapter.
 */
export function generateDevChunkId(chapterId: string, orderIndex: number): string {
  return `${chapterId}-ck-${orderIndex}`;
}

/**
 * Reset the dev store (used in tests).
 */
export function resetDevStore(): void {
  devBooksById.clear();
  devIdCounter = 1;
}
