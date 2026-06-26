import { cookies } from "next/headers";

import {
  DEV_SESSION_COOKIE_NAME,
  deserializeDevSession,
  getSafeSessionSummary,
} from "../lib/web-auth-dev-session";
import { AuthenticatedHome } from "./_components/AuthenticatedHome";
import { HomeLoginEntry } from "./_components/HomeLoginEntry";

export default async function Home() {
  let sessionSummary;

  try {
    const cookieStore = await cookies();
    const rawSession = cookieStore.get(DEV_SESSION_COOKIE_NAME)?.value;
    const sessionPayload = deserializeDevSession(rawSession);
    sessionSummary = getSafeSessionSummary(sessionPayload);
  } catch {
    sessionSummary = getSafeSessionSummary(null);
  }

  if (!sessionSummary.hasSession || !sessionSummary.user) {
    return <HomeLoginEntry />;
  }

  return (
    <AuthenticatedHome
      displayName={sessionSummary.user.displayName}
      sessionMode={sessionSummary.sessionMode ?? "dev-only"}
    />
  );
}
