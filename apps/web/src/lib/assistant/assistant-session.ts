import {
  deserializeDevSession,
  getSafeSessionSummary,
} from "../web-auth-dev-session.ts";

export interface AssistantSessionSummary {
  hasSession: boolean;
  userId: string | null;
  displayName: string | null;
  role: string | null;
  safeSummary: ReturnType<typeof getSafeSessionSummary>;
}

export async function readAssistantSession(): Promise<AssistantSessionSummary> {
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const payload = deserializeDevSession(raw);
    const safeSummary = getSafeSessionSummary(payload);
    return {
      hasSession: safeSummary.hasSession,
      userId: payload?.userIdPreview ?? null,
      displayName: safeSummary.user?.displayName ?? null,
      role: safeSummary.user?.role ?? null,
      safeSummary,
    };
  } catch {
    return {
      hasSession: false,
      userId: null,
      displayName: null,
      role: null,
      safeSummary: getSafeSessionSummary(null),
    };
  }
}
