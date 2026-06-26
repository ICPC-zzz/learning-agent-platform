import { describe, it } from "node:test";
import assert from "node:assert";
import { validateBaseUrl } from "../packages/ai-core/src/model-gateway/ssrf-guard.ts";

describe("SSRF Guard", () => {
  it("allows valid HTTPS URL", () => {
    assert.equal(validateBaseUrl("https://api.openai.com/v1").allowed, true);
  });

  it("rejects HTTP by default", () => {
    assert.equal(validateBaseUrl("http://api.example.com/v1").allowed, false);
  });

  it("allows HTTP when enabled", () => {
    assert.equal(validateBaseUrl("http://api.example.com/v1", { allowHttp: true }).allowed, true);
  });

  it("rejects file protocol", () => {
    const r = validateBaseUrl("file:///etc/passwd");
    assert.equal(r.allowed, false);
  });

  it("rejects localhost", () => {
    assert.equal(validateBaseUrl("https://localhost:8080/v1").allowed, false);
  });

  it("rejects 127.0.0.1", () => {
    assert.equal(validateBaseUrl("https://127.0.0.1/v1").allowed, false);
  });

  it("rejects private IP 192.168.x.x", () => {
    assert.equal(validateBaseUrl("https://192.168.1.1/v1").allowed, false);
  });

  it("rejects private IP 10.x.x.x", () => {
    assert.equal(validateBaseUrl("https://10.0.0.1/v1").allowed, false);
  });

  it("rejects URL with embedded credentials", () => {
    assert.equal(validateBaseUrl("https://user:pass@api.example.com/v1").allowed, false);
  });

  it("rejects IPv6 loopback", () => {
    assert.equal(validateBaseUrl("https://[::1]/v1").allowed, false);
  });

  it("rejects cloud metadata IP", () => {
    assert.equal(validateBaseUrl("https://169.254.169.254/latest/meta-data").allowed, false);
  });

  it("normalizes URL by stripping query", () => {
    const r = validateBaseUrl("https://api.example.com/v1?key=val");
    assert.equal(r.allowed, true);
    if (r.allowed) assert.ok(!r.normalizedUrl.includes("?"));
  });

  it("allows known SaaS domain", () => {
    assert.equal(validateBaseUrl("https://api.openai.com/v1/chat/completions").allowed, true);
  });
});
