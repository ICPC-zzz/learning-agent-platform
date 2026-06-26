import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourcePath = resolve(__dirname, "agent-safety-boundary-summary.ts");
const sourceContent = readFileSync(sourcePath, "utf-8");

function extractArrayFieldLabels(source, constName) {
  const values = [];
  const regex = new RegExp(`${constName}\\s*=\\s*\\[[\\s\\S]*?\\]\\s*as\\s*const`, "m");
  const match = source.match(regex);
  if (!match) return values;
  const block = match[0];
  const labelRegex = /label:\s*["']([^"']*)["']/g;
  let m;
  while ((m = labelRegex.exec(block)) !== null) {
    values.push(m[1]);
  }
  return values;
}

function extractConstValue(source, fieldName) {
  const regex = new RegExp(`${fieldName}:\\s*["']([^"']*)["']`, "m");
  const match = source.match(regex);
  return match?.[1] ?? "";
}

function extractArrayDetailLabels(source, constName) {
  const values = [];
  const regex = new RegExp(`${constName}\\s*=\\s*\\[[\\s\\S]*?\\]\\s*as\\s*const`, "m");
  const match = source.match(regex);
  if (!match) return values;
  const block = match[0];
  const detailRegex = /detail:\s*["']([^"']*)["']/g;
  let m;
  while ((m = detailRegex.exec(block)) !== null) {
    values.push(m[1]);
  }
  return values;
}

describe("Agent Safety Boundary Summary (A288)", () => {
  it("1: overallStatus contains preview-only / mock-only / disabled-by-default", () => {
    const s = extractConstValue(sourceContent, "overallStatus");
    assert.ok(s.includes("preview-only"));
    assert.ok(s.includes("mock-only"));
    assert.ok(s.includes("disabled-by-default"));
  });

  it("2: forbidden includes LLM, tool execution, agent loop, raw prompt/response", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentForbiddenCapabilities");
    const t = labels.join(" ");
    assert.ok(t.includes("LLM") || t.includes("模型"), "must forbid LLM");
    assert.ok(t.includes("工具") || t.includes("tool"), "must forbid tools");
    assert.ok(t.includes("Agent loop") || t.includes("agent loop"), "must forbid agent loop");
    assert.ok(t.includes("prompt") || t.includes("raw"), "must forbid raw prompt/response");
  });

  it("3: allowed list has no real execution capability", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentAllowedCapabilities");
    const details = extractArrayDetailLabels(sourceContent, "agentAllowedCapabilities");
    const t = [...labels, ...details].join(" ").toLowerCase();
    const bad = ["调用真实","执行工具","启动 agent","真实写入","真实同步","real execution","real tool","real agent","真实调用","执行真实","写入数据","发送请求","发起网络"];
    for (const p of bad) {
      assert.ok(!t.includes(p.toLowerCase()), `allowed must not contain: ${p}`);
    }
  });

  it("4: next safe steps have no dangerous suggestions", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentNextSafeSteps");
    const t = labels.join(" ");
    const bad = ["直接调用真实 LLM","直接执行工具","直接启动 Agent loop","直接开放真实执行","跳过安全审查","跳过确认","绕过权限","绕过安全","无需审计","无需用户确认","无需测试","直接上线","直接接入真实"];
    for (const p of bad) {
      assert.ok(!t.includes(p), `next steps must not contain: ${p}`);
    }
  });

  it("5: no actual sensitive values in source", () => {
    const patterns = [
      [/https?:\/\/[^\s"'\]]+/g, "URLs"],
      [/\bfetch\s*\(/g, "fetch calls"],
      [/\bapi[_-]?key\s*[=:]\s*["'][^"']+["']/gi, "API key values"],
      [/\bDATABASE_URL\b/g, "DATABASE_URL"],
      [/\bconnection[_\s]?string\b/gi, "connection string"],
      [/\bpassword\s*[=:]\s*["'][^"']+["']/gi, "password values"],
      [/\bprivate[_\s]?key\s*[=:]/gi, "private key"],
      [/\bBearer\s+[A-Za-z0-9\-_=]+/g, "Bearer tokens"],
      [/sk-[a-zA-Z0-9]{16,}/g, "OpenAI keys"],
      [/\bprocess\.env\b/g, "process.env"],
    ];
    for (const [regex, name] of patterns) {
      const m = sourceContent.match(regex);
      assert.ok(m === null || m.length === 0, `source must not contain ${name}`);
    }
  });

  it("6: runtime statuses has all 8 expected items", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentSafetyRuntimeStatuses");
    assert.equal(labels.length, 8);
    assert.ok(labels.includes("Agent Runtime"));
    assert.ok(labels.includes("LLM Provider"));
    assert.ok(labels.includes("Tool Execution"));
    assert.ok(labels.includes("Agent Loop"));
    assert.ok(labels.includes("Skill Execution"));
    assert.ok(labels.some(l => l.includes("Prompt") || l.includes("Response")));
    assert.ok(labels.includes("DB Write"));
    assert.ok(labels.some(l => l.includes("Network")));
  });

  it("7: forbidden list >= 8 items", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentForbiddenCapabilities");
    assert.ok(labels.length >= 8, `got ${labels.length}`);
  });

  it("8: safety disclaimers >= 5 items", () => {
    const m = sourceContent.match(/safetyDisclaimers[\s\S]*?\][\s\S]*?(?=as const|;)/);
    assert.ok(m, "safetyDisclaimers not found");
    const count = (m[0].match(/["']/g) || []).length / 2;
    assert.ok(count >= 5, `got ~${count}`);
  });

  it("9: not-connected list >= 5 items", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentNotConnectedCapabilities");
    assert.ok(labels.length >= 5, `got ${labels.length}`);
  });

  it("10: next safe steps >= 5 items", () => {
    const labels = extractArrayFieldLabels(sourceContent, "agentNextSafeSteps");
    assert.ok(labels.length >= 5, `got ${labels.length}`);
  });

  it("11: overview contains key safety declarations", () => {
    const overview = extractConstValue(sourceContent, "overview");
    assert.ok(overview.includes("不会调用真实 AI") || overview.includes("不会调用"));
    assert.ok(overview.includes("不会执行工具") || overview.includes("不会"));
    assert.ok(overview.includes("Agent loop"));
  });

  it("12: version references A288 and has lastUpdated", () => {
    const version = extractConstValue(sourceContent, "version");
    const lastUpdated = extractConstValue(sourceContent, "lastUpdated");
    assert.ok(version.length > 0);
    assert.ok(lastUpdated.length > 0);
    assert.ok(version.includes("A288"));
  });
});
