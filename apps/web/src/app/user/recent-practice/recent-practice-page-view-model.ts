/**
 * Recent Practice Page View Model — builds UI views for the
 * /user/recent-practice page, prioritizing DB data with
 * localStorage fallback.
 *
 * @module recent-practice-page-view-model
 * @previewOnly — dev-only; not production user system
 */

import type { RecentPracticeEntry } from "../../../lib/local-user-problem-store";
import type { DbProblemPracticeView } from "../problem-practice-db-loader";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentPracticePageView {
  problemId: string;
  title: string;
  difficulty: string;
  status: string;
  statusLabel: string;
  updatedAt: string;
  source: "db-practice" | "local-practice";
  notice: string;
}

export interface RecentPracticePageViewModel {
  items: RecentPracticePageView[];
  sourceType: "db" | "local" | "empty";
  count: number;
  message: string;
  notice: string;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<string, string> = {
  "not-started": "未开始",
  practiced: "已练习",
  completed: "已完成",
  "needs-review": "需要复习",
};

function mapDbView(view: DbProblemPracticeView): RecentPracticePageView {
  return {
    problemId: view.problemId,
    title: view.problemTitle,
    difficulty: view.difficulty,
    status: view.status,
    statusLabel: STATUS_LABELS[view.status] ?? view.status,
    updatedAt: view.updatedAt,
    source: "db-practice",
    notice: view.notice,
  };
}

function mapLocalView(entry: RecentPracticeEntry): RecentPracticePageView {
  return {
    problemId: entry.problemId,
    title: entry.title,
    difficulty: entry.difficulty,
    status: entry.status,
    statusLabel: STATUS_LABELS[entry.status] ?? entry.status,
    updatedAt: entry.updatedAt,
    source: "local-practice",
    notice: "本地记录 · 未接生产同步 · 仅在当前浏览器中可用",
  };
}

// ---------------------------------------------------------------------------
// View model builder
// ---------------------------------------------------------------------------

export function buildRecentPracticePageViewModel(params: {
  dbPractice: DbProblemPracticeView[];
  dbPracticeEnabled: boolean;
  localPractice: RecentPracticeEntry[];
  hasSession: boolean;
}): RecentPracticePageViewModel {
  const { dbPractice, dbPracticeEnabled, localPractice, hasSession } = params;

  if (dbPracticeEnabled && dbPractice.length > 0) {
    const items = dbPractice.map(mapDbView);
    return {
      items,
      sourceType: "db",
      count: items.length,
      message: `${items.length} 条练习记录（开发 DB）`,
      notice: "开发 DB 练习记录 · 绑定 dev session · 未接生产同步",
    };
  }

  if (localPractice.length > 0) {
    const items = localPractice.map(mapLocalView);
    return {
      items,
      sourceType: "local",
      count: items.length,
      message: `${items.length} 条练习记录（本地）`,
      notice: "数据来自 local storage 本地存储 · 未连接数据库 · 未接生产账号",
    };
  }

  return {
    items: [],
    sourceType: "empty",
    count: 0,
    message: hasSession
      ? "暂无刷题记录。前往题目中心开始练习。"
      : "请先登录 dev session 后使用练习功能。",
    notice: hasSession
      ? "在题目详情页标记练习状态即可记录。"
      : "练习功能需登录 dev session。",
  };
}

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

const SENSITIVE_PATTERNS: RegExp[] = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi[_\s-]*key\b/i,
  /\bDATABASE_URL\b/i,
  /\bcookie\b/i,
  /\bauthorization\b/i,
];

export function recentPracticePageViewModelIsSafe(
  vm: RecentPracticePageViewModel,
): boolean {
  const json = JSON.stringify(vm);
  return !SENSITIVE_PATTERNS.some((p) => p.test(json));
}
