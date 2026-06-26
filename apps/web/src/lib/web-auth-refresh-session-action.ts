"use server";

import { cookies } from "next/headers";
import {
  DEV_SESSION_COOKIE_NAME,
  deserializeDevSession,
  serializeDevSession,
  payloadToSessionData,
} from "./web-auth-dev-session";

/**
 * Refresh the dev session cookie maxAge on each request.
 * Called by SessionRefresher client component on page load.
 * If a valid session exists, extends its maxAge to 7 days.
 */
export async function refreshDevSessionAction(): Promise<{ ok: boolean }> {
  try {
    const ck = await cookies();
    const raw = ck.get(DEV_SESSION_COOKIE_NAME)?.value;
    if (!raw) return { ok: false };

    const payload = deserializeDevSession(raw);
    if (!payload) return { ok: false };

    const session = payloadToSessionData(payload);
    const serialized = serializeDevSession(session);

    ck.set(DEV_SESSION_COOKIE_NAME, serialized, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}
