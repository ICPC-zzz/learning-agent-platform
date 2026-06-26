import type {
  AssistantPageType,
  AssistantVisibleItem,
  SafeAssistantPageContext,
  SafeAssistantPageContextInput,
} from "./assistant-types.ts";

const MAX_SUMMARY_CHARS = 240;
const MAX_TITLE_CHARS = 120;
const MAX_TAGS = 8;
const MAX_VISIBLE_ITEMS = 8;
const MAX_VISIBLE_ITEM_TITLE_CHARS = 80;
const MAX_VISIBLE_ITEM_SUMMARY_CHARS = 120;

const PAGE_TITLES: Record<AssistantPageType, string> = {
  home: "首页",
  articles: "文章",
  article_list: "文章列表",
  article_detail: "文章详情",
  books: "书库",
  book_detail: "书籍详情",
  problems: "题目中心",
  problem_detail: "题目详情",
  user: "个人中心",
  ai: "AI 助手",
  reader: "阅读器",
  learning: "学习中心",
  import: "导入",
  ask: "提问",
  unknown: "未知页面",
};

export function classifyAssistantPageType(pathname: string): AssistantPageType {
  const route = normalizeRoute(pathname);

  if (route === "/" || route === "/home") return "home";
  if (route === "/articles") return "articles";
  if (route.startsWith("/articles/")) return "article_detail";
  if (route.startsWith("/books/") && route.split("/").length > 2) return "book_detail";
  if (route === "/books") return "books";
  if (route === "/problems") return "problems";
  if (route.startsWith("/problems/") && route.split("/").length > 2) return "problem_detail";
  if (route === "/user") return "user";
  if (route.startsWith("/user/")) return "user";
  if (route === "/ai") return "ai";
  if (route.startsWith("/reader")) return "reader";
  if (route.startsWith("/learning")) return "learning";
  if (route.startsWith("/import")) return "import";
  if (route.startsWith("/ask")) return "ask";
  return "unknown";
}

export function getAssistantPageTitle(pageType: AssistantPageType): string {
  return PAGE_TITLES[pageType] ?? PAGE_TITLES.unknown;
}

export function createSafeAssistantPageContext(
  pathname: string,
  input: SafeAssistantPageContextInput = {},
): SafeAssistantPageContext {
  const route = normalizeRoute(input.route ?? pathname);
  const pageType = input.pageType ?? classifyAssistantPageType(route);

  return {
    route,
    pageType,
    title: sanitizeText(input.title ?? getAssistantPageTitle(pageType), MAX_TITLE_CHARS),
    entityId: sanitizeText(input.entityId, 120),
    summary: sanitizeText(input.summary, MAX_SUMMARY_CHARS),
    tags: sanitizeTags(input.tags),
    rating: normalizeRating(input.rating),
    visibleItems: sanitizeVisibleItems(input.visibleItems),
  };
}

export function mergeAssistantPageContext(
  base: SafeAssistantPageContext,
  input: SafeAssistantPageContextInput,
): SafeAssistantPageContext {
  return createSafeAssistantPageContext(base.route, {
    route: input.route ?? base.route,
    pageType: input.pageType ?? base.pageType,
    title: input.title ?? base.title,
    entityId: input.entityId ?? base.entityId,
    summary: input.summary ?? base.summary,
    tags: input.tags ?? base.tags,
    rating: input.rating ?? base.rating,
    visibleItems: input.visibleItems ?? base.visibleItems,
  });
}

export function summarizeVisibleItems(items: AssistantVisibleItem[] | undefined): string {
  if (!items || items.length === 0) return "";

  return items
    .slice(0, MAX_VISIBLE_ITEMS)
    .map((item) => {
      const summary = item.summary ? ` - ${item.summary}` : "";
      return `${item.title}${summary}`;
    })
    .join("; ");
}

function sanitizeVisibleItems(
  items: readonly AssistantVisibleItem[] | undefined,
): AssistantVisibleItem[] | undefined {
  if (!items || items.length === 0) return undefined;

  return items
    .slice(0, MAX_VISIBLE_ITEMS)
    .map((item) => {
      const route = normalizeInternalRoute(item.route);
      return {
        id: sanitizeText(item.id, 120),
        title: sanitizeText(item.title, MAX_VISIBLE_ITEM_TITLE_CHARS) ?? "",
        summary: sanitizeText(item.summary, MAX_VISIBLE_ITEM_SUMMARY_CHARS),
        ...(route ? { route } : {}),
      };
    })
    .filter((item) => item.title.length > 0);
}

function sanitizeTags(tags: readonly string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;

  const normalized = tags
    .map((tag) => sanitizeText(tag, 40) ?? "")
    .filter((tag) => tag.length > 0)
    .slice(0, MAX_TAGS);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRating(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(5, Math.trunc(value)));
}

export function normalizeRoute(pathname: string): string {
  const raw = typeof pathname === "string" ? pathname.trim() : "";
  if (raw.length === 0) return "/";
  const base = raw.startsWith("/") ? raw : `/${raw}`;
  const noHash = base.split("#", 1)[0];
  const noQuery = noHash.split("?", 1)[0];
  return noQuery.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
}

export function normalizeInternalRoute(route: string | undefined | null): string | null {
  if (typeof route !== "string") return null;

  const normalized = normalizeRoute(route);
  if (
    normalized === "/" ||
    normalized === "/articles" ||
    normalized === "/problems" ||
    normalized === "/user" ||
    normalized === "/ai" ||
    normalized === "/reader" ||
    normalized === "/learning" ||
    normalized === "/import" ||
    normalized === "/ask"
  ) {
    return normalized;
  }

  if (normalized.startsWith("/user/")) {
    const allowedUserRoutes = new Set([
      "/user/activity",
      "/user/ai-history",
      "/user/favorites/articles",
      "/user/favorites",
      "/user/favorites/problems",
      "/user/recent-practice",
      "/user/recent-reading",
      "/user/report",
      "/user/review",
      "/user/today",
      "/user/wrong-book",
    ]);
    if (allowedUserRoutes.has(normalized)) {
      return normalized;
    }
  }

  if (/^\/problems\/[A-Za-z0-9_-]{1,128}$/.test(normalized)) {
    return normalized;
  }

  return null;
}

export function isAllowedAssistantNavigationRoute(route: string): boolean {
  return normalizeInternalRoute(route) !== null;
}

function sanitizeText(value: string | undefined | null, maxChars: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) return undefined;
  return normalized.slice(0, maxChars);
}
