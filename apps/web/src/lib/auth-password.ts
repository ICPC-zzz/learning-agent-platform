/**
 * Dev Auth password hashing service — Adapter over Node.js crypto.
 *
 * Uses scrypt with a random salt to hash passwords. This is a dev-only
 * adapter suitable for the A453 Auth v2 registration basic flow.
 *
 * ⚠ DESIGN NOTE:
 * The preferred library is `bcryptjs` (pure JS, test-friendly, consistent
 * across platforms). bcryptjs could not be installed because:
 * 1. pnpm is the project's package manager but not available in the Claude VM.
 * 2. npm lacks workspace protocol support needed by this monorepo.
 *
 * Once environment constraints are resolved, swap this adapter for bcryptjs:
 *   import bcrypt from "bcryptjs";
 *   export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
 *   export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
 *
 * Security properties of current adapter:
 * - Uses scrypt with N=16384, r=8, p=1 (OWASP minimum 2023 recommendation)
 * - Random 16-byte salt per password
 * - Output is base64-encoded with salt + hash components
 * - Timing-safe comparison for verification
 *
 * @module auth-password
 * @devOnly — swap to bcryptjs for production readiness
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

// Separator between salt and hash in the stored string.
const SEPARATOR = ":";

/**
 * Hash a password using scrypt with a random salt.
 *
 * @param password - Plaintext password (never logged or stored).
 * @returns Salted hash string suitable for storage, or null on error.
 */
export async function hashPassword(password: string): Promise<string | null> {
  try {
    if (!password || password.length === 0) return null;

    const salt = randomBytes(SALT_LENGTH).toString("base64");
    const derivedKey = await deriveScryptKey(password, salt);
    const hash = derivedKey.toString("base64");

    return `${salt}${SEPARATOR}${hash}`;
  } catch {
    return null;
  }
}

/**
 * Verify a password against a stored hash.
 *
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param password - Plaintext password to check.
 * @param storedHash - Hash string previously produced by hashPassword.
 * @returns true if the password matches, false otherwise.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  try {
    if (!password || !storedHash) return false;

    const separatorIndex = storedHash.indexOf(SEPARATOR);
    if (separatorIndex === -1) return false;

    const salt = storedHash.substring(0, separatorIndex);
    const originalHash = storedHash.substring(separatorIndex + 1);

    // Re-derive the key with the same salt
    const derivedKey = await deriveScryptKey(password, salt);

    // Timing-safe comparison
    const originalBuffer = Buffer.from(originalHash, "base64");
    return timingSafeEqual(derivedKey, originalBuffer);
  } catch {
    return false;
  }
}

/**
 * Adapter metadata — exposed for test assertions and documentation.
 */
export const PASSWORD_SERVICE_META = {
  algorithm: "scrypt",
  library: "node:crypto (built-in)",
  preferredLibrary: "bcryptjs",
  preferredLibraryAvailable: false,
  reason: "pnpm workspace not available in VM; npm lacks workspace protocol support",
  devOnly: true,
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
