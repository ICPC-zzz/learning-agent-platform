import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { evaluateReaderProgressDbGuard } from "../../reader/reader-progress-db-guard";
import { loadUserRecentReadingDbProgress } from "../user-recent-reading-db-loader";
import type { UserRecentReadingDbLoadResult } from "../user-recent-reading-db-loader";
import {
  buildRecentReadingPageView,
  type RecentReadingPageView,
} from "./recent-reading-page-view-model";
import { AuthStatusCard } from "../../../components/auth/AuthStatusCard";
import { RecentReadingPageClient } from "./recent-reading-page-client";

export default async function RecentReadingPage() {
  const guard = getDevAuthGuardStatus();

  // Session
  let sessionSummary;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    sessionSummary = getSafeSessionSummary(payload);
  } catch {
    sessionSummary = getSafeSessionSummary(null);
  }

  // DB reading progress
  let dbProgress: UserRecentReadingDbLoadResult;
  let dbProgressGuard;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbProgress = await loadUserRecentReadingDbProgress(raw);
    dbProgressGuard = evaluateReaderProgressDbGuard(raw);
  } catch {
    dbProgress = await loadUserRecentReadingDbProgress(undefined);
    dbProgressGuard = evaluateReaderProgressDbGuard(undefined);
  }

  // Build page view model (server-side)
  const pageView = buildRecentReadingPageView({
    hasSession: sessionSummary.hasSession,
    dbProgressItems: dbProgress.hasDbProgress ? dbProgress.items : null,
    dbProgressEnabled: dbProgress.guardEnabled,
    dbProgressMessage: dbProgress.message,
    localEntries: [], // loaded client-side
    ownerLabel: sessionSummary.user?.displayName ?? null,
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A386 User Center Enhancement</p>
          <h1>Recent Reading</h1>
          <p className="status">
            dev preview · local save ·{" "}
            {sessionSummary.hasSession ? "dev session connected" : "not logged in"} · not synced to DB
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/books">
            Books
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/user/favorites/books">
            Favorite Books
          </Link>
          {!sessionSummary.hasSession ? (
            <Link className="primaryLink" href="/login?redirect=/user/recent-reading">
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

      {/* DB Progress Guard Status */}
      <section className="learningPanel" aria-labelledby="db-guard-title">
        <div className="panelHeader">
          <p className="eyebrow">Guard Status</p>
          <h2 id="db-guard-title">
            {dbProgressGuard.enabled
              ? "Reader Progress DB Guard: Enabled"
              : "Reader Progress DB Guard: Disabled"}
          </h2>
        </div>
        <p className="panelNote">
          {dbProgressGuard.enabled
            ? "阅读进度 DB 持久化已启用（dev-only）· 绑定 dev session · 未接生产同步"
            : dbProgressGuard.blockedReasons.length > 0
              ? `阅读进度 DB 持久化未启用：${dbProgressGuard.blockedReasons[0]}`
              : "阅读进度 DB 持久化默认关闭。使用本地记录 fallback。"}
        </p>
      </section>

      <RecentReadingPageClient pageView={pageView} dbProgressEnabled={dbProgress.guardEnabled} />
    </main>
  );
}
