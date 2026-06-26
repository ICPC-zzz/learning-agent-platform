import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AI_PAGE = resolve(__dirname, "ai", "page.tsx");

describe("A462 AI page", function() {
  it("exists", function() { assert.ok(existsSync(AI_PAGE)); });

  const c = readFileSync(AI_PAGE, "utf-8");

  it("title AI 助手", function() { assert.ok(c.includes("AI 助手")); });
  it("renders AiAssistantTabs", function() { assert.ok(c.includes("AiAssistantTabs")); });
  it("uses AssistantConversationProvider", function() { assert.ok(c.includes("AssistantConversationProvider")); });
  it("has session support", function() { assert.ok(c.includes("deserializeDevSession")); });
  it("no secrets in source", function() {
    assert.ok(!c.includes("sk-"));
    assert.ok(!c.includes("DATABASE_URL"));
    assert.ok(!c.includes("apiKey"));
  });
  it("no real LLM provider constructor", function() {
    assert.ok(!c.includes("new OpenAI"));
    assert.ok(!c.includes("new Anthropic"));
  });
  it("no shell execution", function() {
    assert.ok(!c.includes("exec("));
    assert.ok(!c.includes("spawn("));
  });
});
