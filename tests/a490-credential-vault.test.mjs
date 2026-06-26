import { describe, it } from "node:test";
import assert from "node:assert";

process.env.LAP_CREDENTIAL_ENCRYPTION_KEY = Buffer.from(
  "abcdefghijklmnopqrstuvwxyz123456"
).toString("base64");

import {
  encryptCredential,
  decryptCredential,
  getCredentialVaultStatus,
  maskSecret,
} from "../packages/ai-core/src/model-gateway/credential-vault.ts";

describe("Credential Vault", () => {
  it("reports configured", () => {
    assert.equal(getCredentialVaultStatus().configured, true);
  });

  it("encrypts without plaintext", () => {
    const r = encryptCredential("my-secret-api-key-12345");
    assert.ok(!r.encryptedPayload.includes("my-secret"));
  });

  it("decrypts correctly", () => {
    const pt = "test-token-abc123";
    const e = encryptCredential(pt);
    const d = decryptCredential({
      encryptionVersion: e.encryptionVersion,
      encryptedPayload: e.encryptedPayload,
      iv: e.iv,
      authTag: e.authTag,
    });
    assert.equal(d.plaintext, pt);
  });

  it("different nonce each time", () => {
    assert.notEqual(encryptCredential("x").iv, encryptCredential("x").iv);
  });

  it("rejects wrong key", () => {
    const e = encryptCredential("test");
    const old = process.env.LAP_CREDENTIAL_ENCRYPTION_KEY;
    process.env.LAP_CREDENTIAL_ENCRYPTION_KEY = Buffer.from("z".repeat(32)).toString("base64");
    assert.throws(() => decryptCredential({
      encryptionVersion: e.encryptionVersion,
      encryptedPayload: e.encryptedPayload,
      iv: e.iv,
      authTag: e.authTag,
    }));
    process.env.LAP_CREDENTIAL_ENCRYPTION_KEY = old;
  });

  it("rejects tampered auth tag", () => {
    const e = encryptCredential("test");
    const buf = Buffer.from(e.authTag, "base64");
    buf[0] ^= 0xff;
    assert.throws(() => decryptCredential({
      encryptionVersion: e.encryptionVersion,
      encryptedPayload: e.encryptedPayload,
      iv: e.iv,
      authTag: buf.toString("base64"),
    }));
  });

  it("rejects bad version", () => {
    const e = encryptCredential("test");
    assert.throws(() => decryptCredential({
      encryptionVersion: 99,
      encryptedPayload: e.encryptedPayload,
      iv: e.iv,
      authTag: e.authTag,
    }));
  });

  it("rejects null auth tag", () => {
    const e = encryptCredential("test");
    assert.throws(() => decryptCredential({
      encryptionVersion: e.encryptionVersion,
      encryptedPayload: e.encryptedPayload,
      iv: e.iv,
      authTag: null,
    }));
  });

  it("errors without master key", () => {
    const old = process.env.LAP_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.LAP_CREDENTIAL_ENCRYPTION_KEY;
    assert.throws(() => encryptCredential("test"));
    assert.equal(getCredentialVaultStatus().configured, false);
    process.env.LAP_CREDENTIAL_ENCRYPTION_KEY = old;
  });
});

describe("maskSecret", () => {
  it("handles empty and short", () => {
    assert.equal(maskSecret(""), "未配置");
    assert.equal(maskSecret("ab"), "****");
  });

  it("masks with prefix and suffix", () => {
    const m = maskSecret("sk-1234567890abcdef");
    assert.ok(m.startsWith("sk"));
    assert.ok(m.endsWith("cdef"));
    assert.ok(m.includes("****"));
  });

  it("does not reveal full secret", () => {
    const s = "very-long-secret-that-should-be-hidden";
    const m = maskSecret(s);
    assert.ok(!m.includes(s));
  });
});
