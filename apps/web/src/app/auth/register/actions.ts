"use server";

/**
 * Dev-only registration server action.
 *
 * IMPORTANT: This dev registration path is currently disabled because the
 * underlying User model no longer supports username/passwordHash fields.
 * The current auth flow uses email OTP (see email-otp-verify-actions.ts).
 *
 * @module register-server-action
 * @previewOnly - disabled, not production auth
 */

import {
  getDevRegisterGuardStatus,
  registerGuardStatusIsSafe,
} from "../../../lib/web-auth-register-guard";

// ---------------------------------------------------------------------------
// Types (defined locally - no longer in db package)
// ---------------------------------------------------------------------------

export interface DevRegisterResult {
  success: boolean;
  user?: { id: string; username: string };
  reason?: string;
  devOnly: true;
}

/**
 * Dev registration is currently disabled - the User model no longer supports
 * username/passwordHash. Use email OTP registration instead.
 */
export async function devRegisterAction(
  _prevState: unknown,
  _formData: FormData,
): Promise<DevRegisterResult> {
  const guard = getDevRegisterGuardStatus();

  if (!registerGuardStatusIsSafe(guard) || !guard.allowed) {
    return {
      success: false,
      reason: "Dev registration is currently disabled. Please use email OTP registration instead.",
      devOnly: true,
    };
  }

  return {
    success: false,
    reason: "Username/password dev registration is not supported in this version. Use email OTP registration.",
    devOnly: true,
  };
}
