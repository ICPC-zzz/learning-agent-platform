import { getCurrentAuthSession } from "../lib/session/web-auth-session";
import { AuthenticatedHome } from "./_components/AuthenticatedHome";
import { HomeLoginEntry } from "./_components/HomeLoginEntry";
import { loadHomeDashboardData } from "./home-dashboard-loader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getCurrentAuthSession();
  if (!session.hasSession) {
    return <HomeLoginEntry />;
  }

  const dashboard = await loadHomeDashboardData();
  if (dashboard === null) {
    return <HomeLoginEntry />;
  }

  return <AuthenticatedHome data={dashboard} />;
}
