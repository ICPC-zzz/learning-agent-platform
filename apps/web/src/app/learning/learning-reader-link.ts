const READER_PATH = "/reader";

export const LEARNING_READER_LINK_PREVIEW_NOTE =
  "该跳转仅根据开发预览同步记录生成，不代表生产级学习路径推荐。";

export const LEARNING_READER_LINK_UNAVAILABLE_NOTE =
  "若链接不可用，请先在 Reader 中产生本地记录并手动同步。";

export function buildReaderHref(
  bookId?: string | null,
  chapterId?: string | null,
): string | null {
  const normalizedBookId = normalizeOptionalText(bookId);
  const normalizedChapterId = normalizeOptionalText(chapterId);

  if (normalizedBookId === undefined || normalizedChapterId === undefined) {
    return null;
  }

  const searchParams = new URLSearchParams({
    bookId: normalizedBookId,
    chapterId: normalizedChapterId,
  });

  return `${READER_PATH}?${searchParams.toString()}`;
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? undefined : normalized;
}
