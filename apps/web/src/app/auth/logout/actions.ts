"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { revokeCurrentSession } from "../../../lib/session/web-auth-session";
import { DEV_SESSION_COOKIE_NAME } from "../../../lib/web-auth-dev-session";

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  try {
    const cookieStore = await cookies();
    cookieStore.set(DEV_SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } catch {
    // best effort
  }
  redirect("/auth/login");
}
