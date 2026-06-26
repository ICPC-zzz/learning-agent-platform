import { CodeforcesDashboardClient } from "./CodeforcesDashboardClient";
import {
  loadCodeforcesDashboard,
  type CodeforcesDashboardData,
} from "./codeforces-dashboard-loader";

export default async function UserPage() {
  let codeforcesDashboard: CodeforcesDashboardData;

  try {
    codeforcesDashboard = await loadCodeforcesDashboard();
  } catch {
    codeforcesDashboard = {
      hasAccount: false,
      account: null,
      stats: null,
      problemStats: [],
      ratingHistory: [],
      isSyncing: false,
      syncError: "Codeforces database snapshot is currently unavailable",
    };
  }

  return (
    <main className="learningPage">
      <CodeforcesDashboardClient data={codeforcesDashboard} />
    </main>
  );
}
