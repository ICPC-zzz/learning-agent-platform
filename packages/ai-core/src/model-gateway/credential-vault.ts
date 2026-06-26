/**
 * Credential Vault — AES-256-GCM encryption/decryption for user model credentials.
 *
 * - Master key from LAP_CREDENTIAL_ENCRYPTION_KEY env var (Base64, 32 bytes)
 * - Versioned envelope: version(1B) + nonce(12B) + ciphertext + authTag(16B)
 * - Fail-closed: any error returns error, never partial plaintext
 * - Never logs or stores the master key
 */

import crypto from "node:crypto";

const ENV_KEY = "LAP_CREDENTIAL_ENCRYPTION_KEY";
const CURRENT_VERSION = 1;
const GCM_NONCE_LENGTH = 12;
const GCM_AUTH_TAG_LENGTH = 16;

export interface EncryptResult {
  encryptionVersion: number;
  encryptedPayload: string; // Base64
  iv: string; // Base64 nonce
  authTag: string; // Base64 auth tag
}

export interface DecryptResult {
  plaintext: string;
}

export interface CredentialVaultStatus {
  configured: boolean;
  keySource: "env" | "none";
}

function getMasterKey(): Buffer | null {
  const raw = process.env[ENV_KEY];
  if (!raw || raw.trim().length === 0) return null;

  try {
    const key = Buffer.from(raw.trim(), "base64");
    if (key.length !== 32) return null;
    return key;
  } catch {
    return null;
  }
}

export function getCredentialVaultStatus(): CredentialVaultStatus {
  const key = getMasterKey();
  return {
    configured: key !== null,
    keySource: key !== null ? "env" : "none",
  };
}

export function encryptCredential(plaintext: string): EncryptResult {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error("Credential encryption master key is not configured.");
  }

  const nonce = crypto.randomBytes(GCM_NONCE_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, nonce, {
    authTagLength: GCM_AUTH_TAG_LENGTH,
  });

  const versionBuffer = Buffer.from([CURRENT_VERSION]);
  const plaintextBuffer = Buffer.from(plaintext, "utf-8");
  const encrypted = Buffer.concat([
    cipher.update(plaintextBuffer),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    encryptionVersion: CURRENT_VERSION,
    encryptedPayload: encrypted.toString("base64"),
    iv: nonce.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptCredential(input: {
  encryptionVersion: number;
  encryptedPayload: string;
  iv: string;
  authTag: string | null;
}): DecryptResult {
  if (input.encryptionVersion !== CURRENT_VERSION) {
    throw new Error(
      `Unsupported encryption version: ${input.encryptionVersion}. ` +
        `Current version: ${CURRENT_VERSION}. Key rotation required.`,
    );
  }

  if (!input.authTag) {
    throw new Error("Missing auth tag. Credential may be corrupted.");
  }

  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error("Credential encryption master key is not configured.");
  }

  let nonce: Buffer;
  let encrypted: Buffer;
  let authTag: Buffer;

  try {
    nonce = Buffer.from(input.iv, "base64");
    encrypted = Buffer.from(input.encryptedPayload, "base64");
    authTag = Buffer.from(input.authTag, "base64");
  } catch {
    throw new Error("Invalid credential encoding.");
  }

  if (nonce.length !== GCM_NONCE_LENGTH) {
    throw new Error("Invalid nonce length. Credential may be corrupted.");
  }

  if (authTag.length !== GCM_AUTH_TAG_LENGTH) {
    throw new Error("Invalid auth tag length. Credential may be corrupted.");
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey, nonce, {
      authTagLength: GCM_AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return { plaintext: decrypted.toString("utf-8") };
  } catch {
    throw new Error(
      "Credential decryption failed. The credential may have been tampered with " +
        "or the encryption key has changed.",
    );
  }
}

export function generateEncryptionKeyBase64(): string {
  return crypto.randomBytes(32).toString("base64");
}

/**
 * Create a safe masked hint from a secret value.
 * Only shows first two chars and last four chars if long enough.
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length === 0) return "未配置";
  if (secret.length <= 6) return "****";
  return `${secret.slice(0, 2)}****${secret.slice(-4)}`;
}
