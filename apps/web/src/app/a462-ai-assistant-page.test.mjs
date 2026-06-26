import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
var ROOT = process.cwd();

describe("A462 AI page", function() {
  var p = ROOT + "/apps/web/src/app/ai/page.tsx";
  var c = readFileSync(p, "utf-8");
  it("exists", function() { assert.ok(existsSync(p)); });
  it("title AI助手", function() { assert.ok(c.includes("AI助手")); });
  it("states web-limited Agent", function() { assert.ok(c.includes("网页端限制版 Agent")); });
  it("can read page context", function() { assert.ok(c.includes("读取当前网页上下文") || c.includes("当前页面")); });
  it("can read user data summary", function() { assert.ok(c.includes("用户安全数据摘要") || c.includes("用户数据")); });
  it("can use imported content", function() { assert.ok(c.includes("导入内容") || c.includes("文件摘要")); });
  it("shared safety with floating AI", function() { assert.ok(c.includes("悬浮球") || c.includes("共用安全边界")); });
  it("no local dir read", function() { assert.ok(c.includes("不读取用户本地") || c.includes("无法访问用户文件系统")); });
  it("no local dir write", function() { assert.ok(c.includes("不写入用户本地") || c.includes("不执行任何文件写入")); });
  it("no shell execution", function() { assert.ok(c.includes("shell") || c.includes("系统命令")); });
  it("no file operations", function() { assert.ok(c.includes("文件操作") || c.includes("不创建、修改、删除")); });
  it("no MCP tools", function() { assert.ok(c.includes("MCP") || c.includes("mcp")); });
  it("no GitHub write", function() { assert.ok(c.includes("GitHub") || c.includes("github")); });
  it("no real LLM provider", function() { assert.ok(c.includes("不调用真实 LLM") || c.includes("不调用真实 provider") || c.includes("不调用真实")); });
  it("no raw prompt/response saved", function() { assert.ok(c.includes("不保存 raw") || c.includes("不保存原始")); });
  it("mentions Desktop for full Agent", function() { assert.ok(c.includes("Desktop") || c.includes("桌面端") || c.includes("软件端")); });
  it("imports guard", function() { assert.ok(c.includes("evaluateWebAiQaGuard")); });
  it("no secrets", function() { assert.ok(!c.includes("sk-")); assert.ok(!c.includes("DATABASE_URL")); });
  it("no real provider created", function() { assert.ok(!c.includes("new OpenAI") && !c.includes("new Anthropic")); });
});
