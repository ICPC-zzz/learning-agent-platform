"use server";

/**
 * A488 v2 — CF Contest Server Action
 *
 * Fetches upcoming Codeforces contests for display on the problems page.
 *
 * @serverOnly
 */

import { fetchCodeforcesContestList, getUpcomingContests } from "../../lib/cf-contest-service";
import type { CfContestEntry } from "../../lib/cf-contest-service";

export interface ContestCountdownData {
  success: boolean;
  contests: Array<{
    id: number;
    name: string;
    type: string;
    startTimeSeconds: number;
    durationHours: number;
  }>;
  error?: string;
}

export async function getContestCountdownData(): Promise<ContestCountdownData> {
  try {
    const result = await fetchCodeforcesContestList();
    if (!result.success || !result.data) {
      return { success: false, contests: [], error: result.error ?? "获取比赛数据失败" };
    }

    const upcoming = getUpcomingContests(result.data).slice(0, 8); // max 8 upcoming

    return {
      success: true,
      contests: upcoming.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        startTimeSeconds: c.startTimeSeconds,
        durationHours: Math.round(c.durationSeconds / 3600),
      })),
    };
  } catch (error) {
    return {
      success: false,
      contests: [],
      error: error instanceof Error ? error.message : "获取比赛数据失败",
    };
  }
}
