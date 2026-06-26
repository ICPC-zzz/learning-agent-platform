import { getLearningDashboardDatabaseReadResult } from "./learning-db";
import { getLearningDashboardDataFromMock } from "./learning-mock";
import type { LearningDashboardPageData } from "./learning-types";

export { getLearningDashboardDataFromMock as getMockLearningDashboardData } from "./learning-mock";

export async function getLearningDashboardPageData(): Promise<LearningDashboardPageData> {
  const databaseReadResult = await getLearningDashboardDatabaseReadResult();

  if (databaseReadResult.data !== null) {
    return databaseReadResult.data;
  }

  return getLearningDashboardDataFromMock(
    databaseReadResult.fallbackReason ?? "database_read_failed",
  );
}
