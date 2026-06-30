import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const envExample = readFileSync(".env.example", "utf8");
const packageJson = readFileSync("package.json", "utf8");
const loaderSource = readFileSync("scripts/email-env-loader.ts", "utf8");

test("A524 env example contains production placeholders only", () => {
  assert.match(envExample, /^NODE_ENV="production"/m);
  assert.match(envExample, /^APP_BASE_URL="https:\/\/cfagent\.fun"/m);
  assert.match(envExample, /^DATABASE_URL="postgresql:\/\/USER:PASSWORD@127\.0\.0\.1:5432\/DATABASE"/m);
  assert.match(envExample, /^RESEND_API_KEY="re_your_key"/m);
  assert.match(envExample, /^RESEND_FROM_EMAIL="CF Agent <no-reply@auth\.cfagent\.fun>"/m);
  assert.doesNotMatch(envExample, /re_[A-Za-z0-9]{20,}/);
});

test("A524 root scripts expose email doctor and smoke commands", () => {
  assert.match(packageJson, /"email:doctor": "tsx scripts\/email-doctor\.ts"/);
  assert.match(packageJson, /"email:smoke": "tsx scripts\/email-smoke\.ts"/);
});

test("A524 env loader inspects presence without printing values", () => {
  assert.match(loaderSource, /inspectEmailEnvFiles/);
  assert.match(loaderSource, /Record<string, boolean>/);
  assert.match(loaderSource, /variables/);
  assert.doesNotMatch(loaderSource, /console\.log/);
});
