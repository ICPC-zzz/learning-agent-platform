import { cookies } from "next/headers";
import Link from "next/link";
import { deserializeDevSession, getSafeSessionSummary } from "../../../lib/web-auth-dev-session";
import { getDevAuthGuardStatus } from "../../../lib/web-auth-dev-guard";
import { getFavoritesDbStatusForUi } from "../favorites-db-guard";
import { loadDbFavorites } from "../favorites-db-loader";
import type { DbFavoritesLoadResult } from "../favorites-db-view-model";
import {
  buildFavoriteBooksPageView,
  type FavoriteBooksPageView,
} from "./favorite-books-page-view-model";
import { AuthStatusCard } from "../../../components/auth/AuthStatusCard";
import { FavoriteBooksPageClient } from "./favorite-books-page-client";

export default async function FavoriteBooksPage() {
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

  // DB favorites
  let dbFavoritesResult: DbFavoritesLoadResult;
  let dbFavoritesStatus;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    dbFavoritesResult = await loadDbFavorites(raw);
    dbFavoritesStatus = getFavoritesDbStatusForUi(raw);
  } catch {
    dbFavoritesResult = await loadDbFavorites(undefined);
    dbFavoritesStatus = getFavoritesDbStatusForUi(undefined);
  }

  // Build view model (server-side). The local favorites are loaded
  // client-side for this page since they're localStorage-based.
  const pageView = buildFavoriteBooksPageView({
    hasSession: sessionSummary.hasSession,
    dbFavorites: dbFavoritesResult.useDbFavorites ? dbFavoritesResult.items : null,
    dbFavoritesEnabled: dbFavoritesResult.guardEnabled,
    dbFavoritesMessage: dbFavoritesResult.message,
    localFavorites: [], // loaded client-side
    ownerLabel: dbFavoritesResult.ownerLabel,
  });

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A386 User Center Enhancement</p>
          <h1>Favorite Books</h1>
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
          <Link className="secondaryLink" href="/user/recent-reading">
            Recent Reading
          </Link>
          {!sessionSummary.hasSession ? (
            <Link className="primaryLink" href="/login?redirect=/user/favorites/books">
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

      {/* DB Favorites Guard Status */}
      <section className="learningPanel" aria-labelledby="db-guard-title">
        <div className="panelHeader">
          <p className="eyebrow">Guard Status</p>
          <h2 id="db-guard-title">
            {dbFavoritesStatus.enabled
              ? "Favorites DB Guard: Enabled"
              : "Favorites DB Guard: Disabled"}
          </h2>
        </div>
        <p className="panelNote">{dbFavoritesStatus.notice}</p>
      </section>

      <FavoriteBooksPageClient pageView={pageView} dbFavoritesStatus={dbFavoritesStatus} />
    </main>
  );
}
