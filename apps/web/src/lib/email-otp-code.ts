/**
 * Email OTP Code — hashing and verification helper.
 *
 * Uses Node.js crypto (scrypt) for hashing, following the same pattern as
 * auth-password.ts. Never stores or returns plaintext OTP codes.
 *
 * Design notes:
 * - Generates 6-digit numeric OTP codes (helper available, not used this round).
 * - Hash uses scrypt with random salt, stored as "salt:hash" (base64).
 * - Verification uses timing-safe comparison.
 * - All errors are handled gracefully — never throws on verify.
 *
 * @module email-otp-code
 * @devOnly — A468 data model v1, no email sending
 */

import { randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
const SEPARATOR = ":";

/**
 * Generate a 6-digit numeric OTP code.
 *
 * Note: This round (A468) does NOT send the code. It exists as a helper
 * for future rounds (A469) when actual email sending is implemented.
 *
 * @returns A 6-digit numeric string (e.g., "482917").
 */
export function generateOtpCode(): string {
  const code = randomInt(100000, 999999);
  return String(code);
}

/**
 * Hash an OTP code using scrypt with a random salt.
 *
 * Follows the same pattern as hashPassword in auth-password.ts.
 *
 * @param code - Plaintext OTP code (never logged or stored).
 * @returns Salted hash string suitable for storage, or null on error.
 */
export async function hashOtpCode(code: string): Promise<string | null> {
  try {
    if (!code || code.length === 0) return null;

    const salt = randomBytes(SALT_LENGTH).toString("base64");
    const derivedKey = await deriveScryptKey(code, salt);
    const hash = derivedKey.toString("base64");

    return `${salt}${SEPARATOR}${hash}`;
  } catch {
    return null;
  }
}

/**
 * Verify an OTP code against a stored hash.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param code - Plaintext OTP code to check.
 * @param storedHash - Hash string previously produced by hashOtpCode.
 * @returns true if the code matches, false otherwise.
 */
export async function verifyOtpCode(
  code: string,
  storedHash: string,
): Promise<boolean> {
  try {
    if (!code || !storedHash) return false;

    const separatorIndex = storedHash.indexOf(SEPARATOR);
    if (separatorIndex === -1) return false;

    const salt = storedHash.substring(0, separatorIndex);
    const originalHash = storedHash.substring(separatorIndex + 1);

    // Re-derive the key with the same salt
    const derivedKey = await deriveScryptKey(code, salt);

    // Timing-safe comparison
    const originalBuffer = Buffer.from(originalHash, "base64");
    return timingSafeEqual(derivedKey, originalBuffer);
  } catch {
    return false;
  }
}

/**
 * Helper metadata — exposed for test assertions and documentation.
 */
export const OTP_CODE_SERVICE_META = {
  algorithm: "scrypt",
  library: "node:crypto (built-in)",
  otpLength: 6,
  otpCharset: "digits (0-9)",
  devOnly: true,
  sendsEmail: false,
  productionReady: false,
} as const;

function deriveScryptKey(secret: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}
