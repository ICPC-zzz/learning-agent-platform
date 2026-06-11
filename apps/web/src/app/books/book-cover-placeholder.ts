/**
 * Book cover placeholder generator.
 *
 * Produces a stable, deterministic visual token for each book based on its
 * title and bookId. No randomness, no network calls, no external images.
 * All colors are generated from a deterministic hash of the title.
 *
 * @module book-cover-placeholder
 * @previewOnly — dev UI helper
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BookCoverPlaceholder {
  /** The primary letter(s) to display on the cover */
  initials: string;
  /** A stable CSS-friendly hue class (e.g. "cover-hue-3") */
  hueClass: string;
  /** A stable background color in hex */
  bgColor: string;
  /** A readable text color for the cover */
  fgColor: string;
  /** Source display label */
  sourceLabel: string;
  /** Source badge CSS class */
  sourceBadgeClass: string;
  /** Short title for display on cover */
  displayTitle: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Light, pastel background colors — stable palette */
const BG_COLORS: string[] = [
  "#dbeafe", // blue
  "#dcfce7", // green
  "#fef3c7", // amber
  "#fce7f3", // pink
  "#e0e7ff", // indigo
  "#ccfbf1", // teal
  "#f0fdf4", // emerald
  "#fff7ed", // orange
  "#f5f3ff", // violet
  "#ecfeff", // cyan
  "#fef2f2", // red
  "#f0fdfa", // teal-50
];

/** Dark text colors paired with each background */
const FG_COLORS: string[] = [
  "#1e40af", // blue-800
  "#166534", // green-800
  "#92400e", // amber-800
  "#9d174d", // pink-800
  "#3730a3", // indigo-800
  "#115e59", // teal-800
  "#14532d", // emerald-900
  "#9a3412", // orange-800
  "#5b21b6", // violet-800
  "#155e75", // cyan-800
  "#991b1b", // red-800
  "#134e4a", // teal-900
];

const HUE_CLASSES: string[] = [
  "cover-hue-0", "cover-hue-1", "cover-hue-2", "cover-hue-3",
  "cover-hue-4", "cover-hue-5", "cover-hue-6", "cover-hue-7",
  "cover-hue-8", "cover-hue-9", "cover-hue-10", "cover-hue-11",
];

const SOURCE_BADGE_SAMPLE = "badge-sample-book";
const SOURCE_BADGE_DEV = "badge-dev-import";
const SOURCE_BADGE_DB = "badge-database";

// ---------------------------------------------------------------------------
// Hash
// ---------------------------------------------------------------------------

/**
 * Simple deterministic hash function (djb2 variant).
 * Returns a non-negative integer.
 */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return hash >>> 0; // unsigned
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract initials from a title.
 * - Chinese text: take first 1-2 characters
 * - English text: take first letter of first 1-2 words
 */
function extractInitials(title: string): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "?";

  // Check if first char is CJK
  const firstChar = trimmed.charAt(0);
  const isCJK = /[一-鿿㐀-䶿]/.test(firstChar);
  if (isCJK) {
    return trimmed.length >= 2 ? trimmed.slice(0, 2) : trimmed.slice(0, 1);
  }

  // English/Latin: take first letter of up to 2 words
  const words = trimmed.split(/\s+/).filter((w) => w.length > 0);
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/**
 * Truncate title for display on cover.
 */
function truncateTitle(title: string, maxLen: number = 10): string {
  const trimmed = title.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen - 1) + "…";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isSampleSource(sourceType?: string): boolean {
  if (sourceType === undefined) return false;
  return sourceType === "内置示例书" || sourceType === "builtin";
}

export function isDevImportSource(sourceType?: string): boolean {
  if (sourceType === undefined) return false;
  return (
    sourceType === "开发内存书库 / 重启丢失" ||
    sourceType === "dev-import" ||
    sourceType.startsWith("dev-")
  );
}

/**
 * Generate a stable cover placeholder for a book.
 *
 * Same input → same output every time.
 */
export function generateBookCoverPlaceholder(params: {
  bookId: string;
  title: string;
  sourceType?: string;
  difficulty?: string;
  tags?: string[];
}): BookCoverPlaceholder {
  const { bookId, title, sourceType, difficulty, tags } = params;

  // Use bookId+title combined for hash stability
  const hash = hashString(`${bookId}:${title}`);
  const colorIndex = hash % BG_COLORS.length;

  const initials = extractInitials(title);
  const displayTitle = truncateTitle(title, 12);

  let sourceLabel: string;
  let sourceBadgeClass: string;

  if (isDevImportSource(sourceType)) {
    sourceLabel = "开发导入";
    sourceBadgeClass = SOURCE_BADGE_DEV;
  } else if (isSampleSource(sourceType)) {
    sourceLabel = "内置示例";
    sourceBadgeClass = SOURCE_BADGE_SAMPLE;
  } else {
    sourceLabel = sourceType ?? "书库";
    sourceBadgeClass = SOURCE_BADGE_DB;
  }

  return {
    initials,
    hueClass: HUE_CLASSES[colorIndex],
    bgColor: BG_COLORS[colorIndex],
    fgColor: FG_COLORS[colorIndex],
    sourceLabel,
    sourceBadgeClass,
    displayTitle,
  };
}
