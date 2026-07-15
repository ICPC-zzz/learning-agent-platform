import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server.js";

import { middleware } from "../apps/web/src/middleware.ts";

test("B21 production protected-route redirect uses the configured public origin", { concurrency: false }, () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBaseUrl = process.env.APP_BASE_URL;

  try {
    process.env.NODE_ENV = "production";
    process.env.APP_BASE_URL = "https://cfagent.fun";

    const response = middleware(new NextRequest("http://localhost:3000/ai"));
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://cfagent.fun/auth/login?returnTo=%2Fai",
    );
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("APP_BASE_URL", originalBaseUrl);
  }
});

test("B21 production rejects a localhost public origin without leaking it", { concurrency: false }, () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBaseUrl = process.env.APP_BASE_URL;

  try {
    process.env.NODE_ENV = "production";
    process.env.APP_BASE_URL = "https://localhost:3000";

    const response = middleware(new NextRequest("http://localhost:3000/user"));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("location"), null);
  } finally {
    restoreEnv("NODE_ENV", originalNodeEnv);
    restoreEnv("APP_BASE_URL", originalBaseUrl);
  }
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
