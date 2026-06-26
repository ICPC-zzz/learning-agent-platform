"use server";

/**
 * Dev-only login server action.
 *
 * IMPORTANT: This dev login path is currently disabled because the underlying
 * User model no longer supports username/passwordHash fields. The current auth
 * flow uses email OTP (see email-otp-verify-actions.ts).
 *
 * @module login-server-action
 * @previewOnly - disabled, not production auth
 */

import {
  getDevLoginGuardStatus,
  loginGuardStatusIsSafe,
} from "../../../lib/web-auth-login-guard";

// ---------------------------------------------------------------------------
// Types (defined locally - no longer in db package)
// ---------------------------------------------------------------------------

export interface DevLoginResult {
  success: boolean;
  user?: { id: string; username: string };
  reason?: string;
  devOnly: true;
  sessionCreated?: boolean;
}

/**
 * Dev login is currently disabled - the User model no longer supports
 * username/passwordHash. Use email OTP login instead.
 */
export async function devLoginAction(
  _prevState: unknown,
  _formData: FormData,
): Promise<DevLoginResult> {
  const guard = getDevLoginGuardStatus();

  if (!loginGuardStatusIsSafe(guard) || !guard.enabled) {
    return {
      success: false,
      reason: "Dev login is currently disabled. Please use email OTP login instead.",
      devOnly: true,
    };
  }

  return {
    success: false,
    reason: "Username/password dev login is not supported in this version. Use email OTP login.",
    devOnly: true,
  };
}
