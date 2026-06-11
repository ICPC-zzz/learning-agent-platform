import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { AuthStatusCard } from "../../../components/auth/AuthStatusCard";
import { loadDbLearningActivities } from "../learning-activity-db-loader";
import { loadDbReadingSessions } from "../reading-session-db-loader";
import type { LearningActivityDbLoadResult } from "../learning-activity-db-loader";
import type { ReadingSessionDbLoadResult } from "../reading-session-db-loader";
import { buildActivityTimelineView } from "./user-activity-page-view-model";
import type { ActivityTimelineItem } from "./user-activity-page-view-model";
import { UserActivityClientHydration } from "./UserActivityClientHydration";

export default async function UserActivityPage() {
  const guard = getDevAuthGuardStatus();

  let sessionSummary;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    sessionSummary = getSafeSessionSummary(payload);
  } catch {
    sessionSummary = getSafeSessionSummary(null);
  }

  // Load DB learning activities
  let dbActivitiesResult: LearningActivityDbLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbActivitiesResult = await loadDbLearningActivities(raw, 50);
  } catch {
    dbActivitiesResult = await loadDbLearningActivities(undefined, 50);
  }

  // Load DB reading sessions
  let dbSessionsResult: ReadingSessionDbLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbSessionsResult = await loadDbReadingSessions(raw, 50);
  } catch {
    dbSessionsResult = await loadDbReadingSessions(undefined, 50);
  }

  // Build timeline view model (server: DB only, local comes from client hydration)
  const timelineView = buildActivityTimelineView({
    hasSession: sessionSummary.hasSession,
    dbActivities: dbActivitiesResult.useDbActivities ? dbActivitiesResult.items : null,
    dbActivitiesEnabled: dbActivitiesResult.guardEnabled,
    localActivities: [], // filled by client hydration
    dbSessions: dbSessionsResult.useDbSessions ? dbSessionsResult.items : null,
    dbSessionsEnabled: dbSessionsResult.guardEnabled,
    localSessions: [], // filled by client hydration
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A392 Activity Timeline</p>
          <h1>学习活动时间线</h1>
          <p className="status">
            dev preview · local save ·{" "}
            {sessionSummary.hasSession ? "dev session connected" : "not logged in"} · not synced to DB
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/books">
            Books
          </Link>
          <Link className="secondaryLink" href="/reader">
            Reader
          </Link>
          {!sessionSummary.hasSession ? (
            <Link className="primaryLink" href="/login">
              Dev Login
            </Link>
          ) : null}
        </div>
      </header>

      <AuthStatusCard
        hasSession={sessionSummary.hasSession}
        displayName={sessionSummary.user?.displayName ?? null}
        sessionMode={sessionSummary.sessionMode}
        role={sessionSummary.user?.role ?? null}
        status={sessionSummary.status}
        notice={sessionSummary.notice}
        guardEnabled={guard.enabled}
      />

      {/* Timeline summary */}
      <section className="learningPanel" aria-labelledby="timeline-summary-title">
        <div className="panelHeader">
          <p className="eyebrow">A392 Timeline</p>
          <h2 id="timeline-summary-title">活动摘要</h2>
          <p className="panelNote">{timelineView.dataSourceNotice}</p>
        </div>
        <dl className="scoreMeta" style={{ marginTop: "14px" }}>
          <div>
            <dt>总活动数</dt>
            <dd>{timelineView.totalEntries}</dd>
          </div>
          <div>
            <dt>今日活动</dt>
            <dd>{timelineView.todayEntries}</dd>
          </div>
          <div>
            <dt>阅读总时长</dt>
            <dd>{timelineView.totalReadingMinutes} 分钟</dd>
          </div>
          <div>
            <dt>数据来源</dt>
            <dd style={{ fontSize: "12px", color: "#64748b" }}>
              {timelineView.anyDbActive ? "DB + local" : "local only"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Timeline entries */}
      <section className="learningPanel" aria-labelledby="timeline-entries-title">
        <div className="panelHeader">
          <h2 id="timeline-entries-title">活动记录</h2>
          <p className="panelNote">按时间倒序 · 开发预览 · 未接生产账号</p>
        </div>

        <div style={{ marginTop: "14px" }}>
          {timelineView.items.length === 0 ? (
            <div className="learningEmptyState" aria-live="polite">
              <strong>暂无学习活动记录</strong>
              <p>
                {sessionSummary.hasSession
                  ? "在 Reader 中开始阅读或记录练习活动后，将在此处显示。"
                  : "请先登录 dev session。"}
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <Link className="primaryLink" href="/reader">
                  前往 Reader
                </Link>
                <Link className="secondaryLink" href="/problems">
                  前往题目中心
                </Link>
              </div>
            </div>
          ) : (
            <div className="chunkList">
              {timelineView.items.map((item) => (
                <ActivityTimelineEntry key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>

        {/* Client hydration: local-only entries */}
        <UserActivityClientHydration
          hasSession={sessionSummary.hasSession}
          dbEntriesCount={timelineView.items.length}
        />
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Timeline entry component
// ---------------------------------------------------------------------------

function ActivityTimelineEntry({ item }: { item: ActivityTimelineItem }) {
  const typeBadge = getActivityTypeBadge(item.type);
  const sourceBadge = item.source === "db" ? "DB" : "LOCAL";
  const sourceColor = item.source === "db" ? "#2563eb" : "#d97706";
  const time = formatRelativeTime(item.occurredAt);
  const durationStr =
    item.durationSeconds !== null
      ? ` · ${formatDurationLabel(item.durationSeconds)}`
      : "";

  return (
    <article className="chunkItem">
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">
            <span
              style={{
                display: "inline-block",
                background: typeBadge.color,
                color: "#fff",
                borderRadius: "3px",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 6px",
                marginRight: "6px",
              }}
            >
              {typeBadge.label}
            </span>
            <span
              style={{
                display: "inline-block",
                background: sourceColor,
                color: "#fff",
                borderRadius: "3px",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 6px",
              }}
            >
              {sourceBadge}
            </span>
            {" "}{time}{durationStr}
          </p>
          <h4 style={{ fontSize: "14px", margin: "4px 0 2px 0" }}>{sanitizeHtml(item.title)}</h4>
          <p className="panelNote">{getActivityDescription(item)}</p>
        </div>
        {getActivityLink(item)}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TypeBadge {
  label: string;
  color: string;
}

function getActivityTypeBadge(type: string): TypeBadge {
  switch (type) {
    case "read-book":
      return { label: "阅读", color: "#2563eb" };
    case "reading-session":
      return { label: "阅读计时", color: "#7c3aed" };
    case "practice-problem":
      return { label: "练习", color: "#16a34a" };
    case "favorite-book":
      return { label: "收藏书籍", color: "#d97706" };
    case "favorite-problem":
      return { label: "收藏题目", color: "#d97706" };
    case "add-note":
      return { label: "笔记", color: "#0891b2" };
    case "add-bookmark":
      return { label: "书签", color: "#6366f1" };
    case "import-book":
      return { label: "导入", color: "#64748b" };
    default:
      return { label: type, color: "#64748b" };
  }
}

function getActivityDescription(item: ActivityTimelineItem): string {
  if (item.chapterId) {
    return `章节: ${item.chapterId}`;
  }
  if (item.problemId) {
    return `题目: ${item.problemId}`;
  }
  return `目标: ${item.targetId}`;
}

function getActivityLink(item: ActivityTimelineItem): React.ReactNode {
  if (item.bookId && item.chapterId) {
    return (
      <Link
        className="primaryLink"
        href={`/reader?bookId=${encodeURIComponent(item.bookId)}&chapterId=${encodeURIComponent(item.chapterId)}`}
        style={{ fontSize: "12px" }}
      >
        继续阅读
      </Link>
    );
  }
  if (item.problemId) {
    return (
      <Link
        className="primaryLink"
        href={`/problems/${encodeURIComponent(item.problemId)}`}
        style={{ fontSize: "12px" }}
      >
        查看题目
      </Link>
    );
  }
  return null;
}

function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;
    return date.toLocaleDateString("zh-CN");
  } catch {
    return isoString;
  }
}

function formatDurationLabel(seconds: number): string {
  const clamped = Math.min(Math.max(0, Math.trunc(seconds)), 28800);
  const minutes = Math.round(clamped / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h${remainingMinutes}m` : `${hours}h`;
  }
  return `${minutes}分钟`;
}

function sanitizeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
