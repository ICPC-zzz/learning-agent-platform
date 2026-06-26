import { cookies } from "next/headers";
import Link from "next/link";

import { deserializeDevSession, getSafeSessionSummary } from "../../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../../lib/web-auth-dev-guard";
import { loadDbArticleFavorites, type DbArticleFavoritesLoadResult } from "../../article-favorites-db-loader";
import { AuthStatusCard } from "../../../../components/auth/AuthStatusCard";
import { UserFavoriteArticlesPanel } from "../../../../components/user/UserFavoriteArticlesPanel";

export default async function FavoriteArticlesPage() {
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

  let dbFavorites: DbArticleFavoritesLoadResult;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbFavorites = await loadDbArticleFavorites(raw);
  } catch {
    dbFavorites = await loadDbArticleFavorites(undefined);
  }

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A476 Article Favorites</p>
          <h1>收藏文章</h1>
          <p className="status">
            dev preview 路 local save 路 {sessionSummary.hasSession ? "dev session connected" : "not logged in"} 路 not synced to DB
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            Home
          </Link>
          <Link className="secondaryLink" href="/articles">
            Articles
          </Link>
          <Link className="secondaryLink" href="/user">
            User Center
          </Link>
          <Link className="secondaryLink" href="/user/recent-reading">
            最近阅读文章
          </Link>
          {!sessionSummary.hasSession ? (
            <Link className="primaryLink" href="/login?redirect=/user/favorites/articles">
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

      <section className="learningPanel" aria-labelledby="db-guard-title">
        <div className="panelHeader">
          <p className="eyebrow">Guard Status</p>
          <h2 id="db-guard-title">
            {dbFavorites.guardEnabled ? "Article Favorites DB Guard: Enabled" : "Article Favorites DB Guard: Disabled"}
          </h2>
        </div>
        <p className="panelNote">{dbFavorites.message}</p>
      </section>

      <UserFavoriteArticlesPanel
        hasSession={sessionSummary.hasSession}
        dbFavorites={dbFavorites.useDbFavorites ? dbFavorites.items : null}
        dbEnabled={dbFavorites.guardEnabled}
        ownerLabel={dbFavorites.ownerLabel}
      />
    </main>
  );
}
