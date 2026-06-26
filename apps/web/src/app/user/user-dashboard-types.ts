/**
 * User dashboard view model types.
 *
 * A376: Extended with session-aware view model for dev auth v1.
 */

import type { FavoriteBookEntry, RecentReadingEntry } from "../../lib/local-user-library-store";

export interface UserInfoView {
  nickname: string;
  status: string;
  notice: string;
  hasSession?: boolean;
  sessionMode?: string | null;
  sessionRole?: string | null;
}

export interface UserDashboardView {
  user: UserInfoView;
  favoriteBooks: FavoriteBookEntry[];
  recentReadings: RecentReadingEntry[];
}

export interface DevSessionInfo {
  hasSession: boolean;
  userIdPreview: string | null;
  displayName: string | null;
  role: string | null;
  sessionMode: string | null;
  createdAt: string | null;
}

export function getUserInfoView(session?: DevSessionInfo | null): UserInfoView {
  if (session?.hasSession) {
    return {
      nickname: session.displayName ?? "dev user",
      status: "dev session connected",
      notice: "Current dev session, not production auth. Local data not synced.",
      hasSession: true,
      sessionMode: session.sessionMode,
      sessionRole: session.role,
    };
  }
  return {
    nickname: "not logged in",
    status: "no real login",
    notice: "Not logged in. Local browser data only.",
    hasSession: false,
    sessionMode: null,
    sessionRole: null,
  };
}

export function buildUserDashboardView(params: {
  favorites: FavoriteBookEntry[];
  recentReadings: RecentReadingEntry[];
  session?: DevSessionInfo | null;
}): UserDashboardView {
  return {
    user: getUserInfoView(params.session),
    favoriteBooks: params.favorites.slice(0, 20),
    recentReadings: params.recentReadings.slice(0, 20),
  };
}

export const EMPTY_STATE_MESSAGES = {
  favoriteBooks: "no favorite books",
  recentReading: "no recent reading",
  recentProblems: "no recent problems",
  favoriteProblems: "favorite problems not yet implemented",
} as const;
