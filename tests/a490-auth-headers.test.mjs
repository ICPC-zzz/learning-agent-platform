import { describe, it } from "node:test";
import assert from "node:assert";
import { buildAuthHeaders, getCredentialFieldsForAuthMode } from "../packages/ai-core/src/model-gateway/auth-headers.ts";

describe("Auth Headers", () => {
  it("builds Bearer header", () => {
    const r = buildAuthHeaders({ mode: "bearer", token: "sk-test123" });
    assert.equal(r.errors.length, 0);
    assert.equal(r.headers["Authorization"], "Bearer sk-test123");
  });

  it("errors when bearer token missing", () => {
    assert.ok(buildAuthHeaders({ mode: "bearer" }).errors.length > 0);
  });

  it("uses custom API key header name", () => {
    const r = buildAuthHeaders({ mode: "api_key_header", apiKeyHeaderName: "x-api-key", token: "my-key" });
    assert.equal(r.headers["x-api-key"], "my-key");
  });

  it("defaults API key header to api-key", () => {
    assert.equal(buildAuthHeaders({ mode: "api_key_header", token: "kk" }).headers["api-key"], "kk");
  });

  it("builds Basic auth header", () => {
    const r = buildAuthHeaders({ mode: "basic_auth", username: "admin", password: "secret" });
    assert.ok(r.headers["Authorization"]?.startsWith("Basic "));
  });

  it("errors when basic auth username missing", () => {
    assert.ok(buildAuthHeaders({ mode: "basic_auth", password: "s" }).errors.length > 0);
  });

  it("errors when basic auth password missing", () => {
    assert.ok(buildAuthHeaders({ mode: "basic_auth", username: "u" }).errors.length > 0);
  });

  it("adds custom headers", () => {
    const r = buildAuthHeaders({ mode: "custom_headers", customHeaders: [{ name: "x-custom", value: "v1" }] });
    assert.equal(r.headers["x-custom"], "v1");
  });

  it("rejects forbidden Host header", () => {
    assert.ok(buildAuthHeaders({ mode: "custom_headers", customHeaders: [{ name: "Host", value: "evil" }] }).errors.length > 0);
  });

  it("rejects Content-Length header", () => {
    assert.ok(buildAuthHeaders({ mode: "custom_headers", customHeaders: [{ name: "Content-Length", value: "0" }] }).errors.length > 0);
  });

  it("rejects Cookie header", () => {
    assert.ok(buildAuthHeaders({ mode: "custom_headers", customHeaders: [{ name: "Cookie", value: "x" }] }).errors.length > 0);
  });

  it("returns no headers for none mode", () => {
    const r = buildAuthHeaders({ mode: "none" });
    assert.equal(r.errors.length, 0);
    assert.equal(Object.keys(r.headers).length, 0);
  });

  it("returns fields for bearer", () => {
    assert.ok(getCredentialFieldsForAuthMode("bearer").some(f => f.key === "token"));
  });

  it("returns fields for basic_auth", () => {
    const f = getCredentialFieldsForAuthMode("basic_auth");
    assert.ok(f.some(x => x.key === "username"));
    assert.ok(f.some(x => x.key === "password"));
  });

  it("returns no fields for none", () => {
    assert.equal(getCredentialFieldsForAuthMode("none").length, 0);
  });
});
