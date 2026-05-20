export type ChapterQaProviderErrorCategory =
  | "timeout"
  | "network_error"
  | "provider_http_error"
  | "invalid_provider_response"
  | "empty_answer"
  | "provider_unavailable"
  | "unknown_provider_error";

export type ChapterQaFallbackReason = ChapterQaProviderErrorCategory;

export interface ChapterQaProviderErrorInfo {
  category: ChapterQaProviderErrorCategory;
  networkAttempted: boolean;
}

const chapterQaProviderErrorCategories: readonly ChapterQaProviderErrorCategory[] =
  [
    "timeout",
    "network_error",
    "provider_http_error",
    "invalid_provider_response",
    "empty_answer",
    "provider_unavailable",
    "unknown_provider_error",
  ];

export function isChapterQaProviderErrorCategory(
  value: unknown,
): value is ChapterQaProviderErrorCategory {
  return (
    typeof value === "string" &&
    chapterQaProviderErrorCategories.some((category) => category === value)
  );
}
