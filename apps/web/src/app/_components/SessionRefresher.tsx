"use client";

import { useEffect, useRef } from "react";
import { refreshDevSessionAction } from "../../lib/web-auth-refresh-session-action";

/**
 * Client component that refreshes the dev session cookie maxAge on every page load.
 * Prevents the session from expiring while the user is actively using the app.
 *
 * Does NOT block rendering — runs fire-and-forget on mount.
 */
export function SessionRefresher() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void refreshDevSessionAction();
  }, []);

  return null;
}
