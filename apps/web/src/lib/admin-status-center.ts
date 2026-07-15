/**
 * Admin Status Center — 只读系统状态聚合器
 *
 * Aggregates guard states from all subsystems into a safe, client-safe format.
 * No env values, tokens, secrets, or DATABASE_URL values are ever exposed.
 *
 * Categories:
 * - LLM / AI Assistant
 * - Book API
 * - Problem API
 * - Phone Auth / SMS OTP
 * - Email Auth
 * - DB Readiness
 * - Agent / MCP / GitHub (preview-only)
 * - Import Readiness
 *
 * @previewOnly — productionReady=false
 * @safeToExposeToClient — no env values, only variable names and boolean states
 */

import { evaluateWebAiQaGuard } from "./web-ai-qa-guard.ts";
import {
  createAssistantProviderEnvSnapshot,
  loadAssistantProviderConfig,
} from "./assistant/config/assistant-provider-config.ts";
import { getLlmDevProviderConfig } from "./llm-dev-provider-config.ts";
import { LLM_DEV_ENV, LLM_DEV_ENV_LEGACY } from "./llm-dev-provider-config.ts";
import {
  evaluateExternalApiDevGuard,
  getUnifiedApiStatus,
  BOOK_API_CONTRACT,
  PROBLEM_API_CONTRACT,
  PHONE_AUTH_CONTRACT,
  EMAIL_AUTH_CONTRACT,
} from "@learning-agent-platform/shared";
import { evaluatePdfImportGuard } from "./pdf-import-guard";
import { evaluateDocxImportGuard } from "./docx-import-guard";
import { getEmailOtpGuardStatus } from "./web-auth-email-otp-guard";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatusCategory =
  | "llm"
  | "book-api"
  | "problem-api"
  | "phone-auth"
  | "email-auth"
  | "db"
  | "agent-mcp"
  | "import"
  | "ui-shell";

export type StatusValue =
  | "enabled"
  | "blocked"
  | "missing-env"
  | "preview-only"
  | "unavailable";

export interface StatusItem {
  /** Unique key for this status item (e.g., "llm.web_qa_dev_enabled"). */
  key: string;
  /** Human-readable label in Chinese. */
  label: string;
  /** Grouping category. */
  category: StatusCategory;
  /** Computed status. */
  status: StatusValue;
  /** Names of required environment variables (names only, no values). */
  requiredEnvNames: string[];
  /** Names of configured environment variables (names only, no values). */
  configuredEnvNames: string[];
  /** Names of missing environment variables (names only, no values). */
  missingEnvNames: string[];
  /** Safe, human-readable description — no secrets. */
  safeDescription: string;
  /** Always false — dev-only. */
  productionReady: false;
  /** Always true — safe for client rendering. */
  safeToExposeToClient: true;
  /** Whether production is explicitly blocked. */
  productionBlocked: boolean;
}

export type StatusGroupLabel =
  | "External APIs"
  | "AI Assistant"
  | "Database"
  | "Imports"
  | "Agent Preview"
  | "UI Shell";

export interface StatusGroup {
  label: StatusGroupLabel;
  items: StatusItem[];
}

export interface AdminStatusSnapshot {
  /** All status items, keyed by category. */
  items: StatusItem[];
  /** Items grouped for display. */
  groups: StatusGroup[];
  /** Summary counts. */
  summary: {
    total: number;
    enabled: number;
    blocked: number;
    missingEnv: number;
    previewOnly: number;
    unavailable: number;
  };
  /** Always false. */
  productionReady: false;
  /** Always true. */
  safeToExposeToClient: true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeGetEnv(name: string): string | undefined {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

function safeHasDbUrl(): boolean {
  try {
    const url = safeGetEnv("DATABASE_URL");
    return typeof url === "string" && url.trim().length > 0;
  } catch {
    return false;
  }
}

function makeItem(
  key: string,
  label: string,
  category: StatusCategory,
  status: StatusValue,
  requiredEnvNames: string[],
  configuredEnvNames: string[],
  missingEnvNames: string[],
  safeDescription: string,
  productionBlocked?: boolean,
): StatusItem {
  return {
    key,
    label,
    category,
    status,
    requiredEnvNames: [...new Set(requiredEnvNames)],
    configuredEnvNames: [...new Set(configuredEnvNames)],
    missingEnvNames: [...new Set(missingEnvNames)],
    safeDescription,
    productionReady: false as const,
    safeToExposeToClient: true as const,
    productionBlocked: productionBlocked ?? false,
  };
}

function computeSummary(items: StatusItem[]) {
  let enabled = 0;
  let blocked = 0;
  let missingEnv = 0;
  let previewOnly = 0;
  let unavailable = 0;
  for (const item of items) {
    switch (item.status) {
      case "enabled": enabled++; break;
      case "blocked": blocked++; break;
      case "missing-env": missingEnv++; break;
      case "preview-only": previewOnly++; break;
      case "unavailable": unavailable++; break;
    }
  }
  return { total: items.length, enabled, blocked, missingEnv, previewOnly, unavailable };
}

// ---------------------------------------------------------------------------
// Status collectors
// ---------------------------------------------------------------------------

function collectLlmStatus(): StatusItem[] {
  const env = createAssistantProviderEnvSnapshot();
  const guard = evaluateWebAiQaGuard(env);
  const runtimeConfig = loadAssistantProviderConfig(env);

  const config = getLlmDevProviderConfig();

  const items: StatusItem[] = [];

  const runtimeRequiredEnvNames = [
    "LAP_ALLOW_PRODUCTION_WEB_AI",
    "LAP_ALLOW_REAL_LLM",
    "LAP_ASSISTANT_ENABLED",
    "LAP_ASSISTANT_EXTERNAL_TOOLS_ENABLED",
    "LAP_LLM_ENABLED",
    "LAP_LLM_BASE_URL",
    "LAP_LLM_MODEL",
  ];

  items.push(makeItem(
    "llm.dev_provider",
    "Web AI 模型服务状态",
    "llm",
    guard.allowed ? "enabled" : (guard.missingEnvKeys.length > 0 ? "missing-env" : "blocked"),
    runtimeRequiredEnvNames,
    runtimeRequiredEnvNames.filter((name) => !guard.missingEnvKeys.includes(name)),
    [...guard.missingEnvKeys],
    guard.allowed
      ? `${guard.notice} Provider: ${runtimeConfig.llm.provider}，Model: ${runtimeConfig.llm.model ?? "未指定"}。`
      : guard.notice,
    !guard.nonProduction && !guard.allowed,
  ));

  // Provider
  const providerName = runtimeConfig.llm.provider === "none" ? undefined : runtimeConfig.llm.provider;
  items.push(makeItem(
    "llm.provider",
    "LLM Provider",
    "llm",
    providerName ? "enabled" : "missing-env",
    [LLM_DEV_ENV.PROVIDER],
    providerName ? [LLM_DEV_ENV.PROVIDER] : [],
    providerName ? [] : [LLM_DEV_ENV.PROVIDER],
    providerName ? `Provider: ${providerName}` : "Provider 未指定。",
  ));

  // Web AI allow
  const allowDevLlm = config.envStatus.find((s) => s.name === LLM_DEV_ENV.ALLOW_DEV_LLM);
  const allowWebAi = config.envStatus.find((s) => s.name === LLM_DEV_ENV.ALLOW_WEB_AI);
  items.push(makeItem(
    "llm.allow_dev_llm",
    `${LLM_DEV_ENV.ALLOW_DEV_LLM} / ${LLM_DEV_ENV_LEGACY.ALLOW_DEV_LLM}`,
    "llm",
    allowDevLlm?.configured ? "enabled" : "missing-env",
    [LLM_DEV_ENV.ALLOW_DEV_LLM, LLM_DEV_ENV_LEGACY.ALLOW_DEV_LLM],
    allowDevLlm?.configured ? [LLM_DEV_ENV.ALLOW_DEV_LLM] : [],
    allowDevLlm?.configured ? [] : [LLM_DEV_ENV.ALLOW_DEV_LLM],
    "LLM dev provider 主开关（支持新旧变量名）。",
  ));

  items.push(makeItem(
    "llm.allow_web_ai",
    `${LLM_DEV_ENV.ALLOW_WEB_AI} / ${LLM_DEV_ENV_LEGACY.ALLOW_WEB_AI}`,
    "llm",
    allowWebAi?.configured ? "enabled" : "missing-env",
    [LLM_DEV_ENV.ALLOW_WEB_AI, LLM_DEV_ENV_LEGACY.ALLOW_WEB_AI],
    allowWebAi?.configured ? [LLM_DEV_ENV.ALLOW_WEB_AI] : [],
    allowWebAi?.configured ? [] : [LLM_DEV_ENV.ALLOW_WEB_AI],
    "Web AI 助手调用 LLM 开关（支持新旧变量名）。",
  ));

  // Endpoint
  const endpointCfg = config.envStatus.find((s) => s.name === LLM_DEV_ENV.ENDPOINT);
  items.push(makeItem(
    "llm.endpoint",
    LLM_DEV_ENV.ENDPOINT,
    "llm",
    endpointCfg?.configured ? "enabled" : "missing-env",
    [LLM_DEV_ENV.ENDPOINT],
    endpointCfg?.configured ? [LLM_DEV_ENV.ENDPOINT] : [],
    endpointCfg?.configured ? [] : [LLM_DEV_ENV.ENDPOINT],
    "LLM 开发端点 URL（仅显示是否配置，不显示值）。",
  ));

  // API key
  const apiKeyCfg = config.envStatus.find((s) => s.name === LLM_DEV_ENV.API_KEY);
  items.push(makeItem(
    "llm.api_key",
    LLM_DEV_ENV.API_KEY,
    "llm",
    apiKeyCfg?.configured ? "enabled" : "missing-env",
    [LLM_DEV_ENV.API_KEY],
    apiKeyCfg?.configured ? [LLM_DEV_ENV.API_KEY] : [],
    apiKeyCfg?.configured ? [] : [LLM_DEV_ENV.API_KEY],
    "API Key（仅显示是否配置，不显示值）。",
  ));

  // API password (with legacy compat)
  const apiPwCfg = config.envStatus.find((s) => s.name === LLM_DEV_ENV.API_PASSWORD);
  const legacyPw = safeGetEnv(LLM_DEV_ENV_LEGACY.API_PASSWORD);
  const pwConfigured = apiPwCfg?.configured || (typeof legacyPw === "string" && legacyPw.trim().length > 0);
  items.push(makeItem(
    "llm.api_password",
    `${LLM_DEV_ENV.API_PASSWORD} / ${LLM_DEV_ENV_LEGACY.API_PASSWORD}`,
    "llm",
    pwConfigured ? "enabled" : "missing-env",
    [LLM_DEV_ENV.API_PASSWORD, LLM_DEV_ENV_LEGACY.API_PASSWORD],
    pwConfigured ? [apiPwCfg?.configured ? LLM_DEV_ENV.API_PASSWORD : LLM_DEV_ENV_LEGACY.API_PASSWORD] : [],
    pwConfigured ? [] : [LLM_DEV_ENV.API_PASSWORD],
    "API Password（支持新旧变量名，仅显示是否配置，不显示值）。对 Spark OpenAI endpoint 可选。",
  ));

  // Model
  items.push(makeItem(
    "llm.model",
    LLM_DEV_ENV.MODEL,
    "llm",
    runtimeConfig.llm.model ? "enabled" : "missing-env",
    [LLM_DEV_ENV.MODEL],
    runtimeConfig.llm.model ? [LLM_DEV_ENV.MODEL] : [],
    runtimeConfig.llm.model ? [] : [LLM_DEV_ENV.MODEL],
    `Model: ${runtimeConfig.llm.model ?? "未指定"}。`,
  ));

  // Runtime mode check
  items.push(makeItem(
    "llm.non_production",
    "Web AI 运行模式",
    "llm",
    guard.allowed ? "enabled" : "blocked",
    [],
    [],
    [],
    guard.allowed
      ? (guard.productionReady ? "正式模型模式已通过双重授权。" : "开发模型模式已显式启用。")
      : guard.notice,
    !guard.nonProduction && !guard.allowed,
  ));

  // Health check status
  items.push(makeItem(
    "llm.health_check",
    "LLM Health Check 可用",
    "llm",
    guard.allowed ? "enabled" : "blocked",
    [],
    [],
    [],
    guard.allowed ? "LLM 健康检查可用。" : "LLM 健康检查不可用。",
    !guard.nonProduction && !guard.allowed,
  ));

  return items;
}

function collectBookApiStatus(): StatusItem[] {
  const contract = BOOK_API_CONTRACT;
  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
  });
  const unified = getUnifiedApiStatus(guard);

  const items: StatusItem[] = [];

  const bookStatus: StatusValue = guard.allowed ? "enabled" : (guard.missingEnvNames.length > 0 ? "missing-env" : "blocked");
  items.push(makeItem(
    "book-api.guard",
    "Book API Guard 状态",
    "book-api",
    bookStatus,
    [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    [...guard.missingEnvNames],
    guard.allowed
      ? "Book API 外部调用已启用（dev-only preview）。"
      : `Book API 已阻止。原因：${guard.blockedReason ?? "missing env"}。`,
    unified.productionBlocked,
  ));

  items.push(makeItem(
    "book-api.allow_external",
    "LAP_ALLOW_EXTERNAL_BOOK_API",
    "book-api",
    safeGetEnv("LAP_ALLOW_EXTERNAL_BOOK_API") === "true" ? "enabled" : "missing-env",
    ["LAP_ALLOW_EXTERNAL_BOOK_API"],
    safeGetEnv("LAP_ALLOW_EXTERNAL_BOOK_API") === "true" ? ["LAP_ALLOW_EXTERNAL_BOOK_API"] : [],
    safeGetEnv("LAP_ALLOW_EXTERNAL_BOOK_API") === "true" ? [] : ["LAP_ALLOW_EXTERNAL_BOOK_API"],
    "允许外部 Book API 调用开关。",
  ));

  items.push(makeItem(
    "book-api.base_url",
    "LAP_BOOK_API_BASE_URL",
    "book-api",
    typeof safeGetEnv("LAP_BOOK_API_BASE_URL") === "string" && safeGetEnv("LAP_BOOK_API_BASE_URL")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_BOOK_API_BASE_URL"],
    typeof safeGetEnv("LAP_BOOK_API_BASE_URL") === "string" && safeGetEnv("LAP_BOOK_API_BASE_URL")!.trim().length > 0 ? ["LAP_BOOK_API_BASE_URL"] : [],
    typeof safeGetEnv("LAP_BOOK_API_BASE_URL") === "string" && safeGetEnv("LAP_BOOK_API_BASE_URL")!.trim().length > 0 ? [] : ["LAP_BOOK_API_BASE_URL"],
    "Book API 基础 URL（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "book-api.api_key",
    "LAP_BOOK_API_KEY",
    "book-api",
    typeof safeGetEnv("LAP_BOOK_API_KEY") === "string" && safeGetEnv("LAP_BOOK_API_KEY")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_BOOK_API_KEY"],
    typeof safeGetEnv("LAP_BOOK_API_KEY") === "string" && safeGetEnv("LAP_BOOK_API_KEY")!.trim().length > 0 ? ["LAP_BOOK_API_KEY"] : [],
    typeof safeGetEnv("LAP_BOOK_API_KEY") === "string" && safeGetEnv("LAP_BOOK_API_KEY")!.trim().length > 0 ? [] : ["LAP_BOOK_API_KEY"],
    "Book API Key（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "book-api.provider",
    "LAP_BOOK_API_PROVIDER",
    "book-api",
    typeof safeGetEnv("LAP_BOOK_API_PROVIDER") === "string" && safeGetEnv("LAP_BOOK_API_PROVIDER")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_BOOK_API_PROVIDER"],
    typeof safeGetEnv("LAP_BOOK_API_PROVIDER") === "string" && safeGetEnv("LAP_BOOK_API_PROVIDER")!.trim().length > 0 ? ["LAP_BOOK_API_PROVIDER"] : [],
    typeof safeGetEnv("LAP_BOOK_API_PROVIDER") === "string" && safeGetEnv("LAP_BOOK_API_PROVIDER")!.trim().length > 0 ? [] : ["LAP_BOOK_API_PROVIDER"],
    "Book API provider 标识。",
  ));

  // Import readiness derived from API status
  items.push(makeItem(
    "book-api.import_preview",
    "Book Import Preview",
    "book-api",
    guard.allowed ? "enabled" : "preview-only",
    guard.allowed ? [] : [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    guard.allowed ? [] : [...guard.missingEnvNames],
    guard.allowed
      ? "Book API 就绪：Open Library 搜索预览已接入 /books 页面，单本导入已接入（dev-only，需 LAP_ALLOW_DEV_BOOK_IMPORT=true）。"
      : "Book API 未就绪，仅支持文本导入预览。",
  ));

  items.push(makeItem(
    "book-api.import_save",
    "Book Import Save",
    "book-api",
    safeGetEnv("LAP_ALLOW_DEV_BOOK_IMPORT") === "true" ? "enabled" : "preview-only",
    ["LAP_ALLOW_DEV_BOOK_IMPORT", "LAP_IMPORT_DB_PERSIST_DEV_ENABLED", "LAP_ALLOW_REAL_DB_INTEGRATION"],
    safeGetEnv("LAP_ALLOW_DEV_BOOK_IMPORT") === "true" ? ["LAP_ALLOW_DEV_BOOK_IMPORT"] : [],
    safeGetEnv("LAP_ALLOW_DEV_BOOK_IMPORT") === "true" ? [] : ["LAP_ALLOW_DEV_BOOK_IMPORT"],
    safeGetEnv("LAP_ALLOW_DEV_BOOK_IMPORT") === "true"
      ? "Open Library 单本导入可用（dev-only）。需同时启用 DB persist guard。"
      : "Open Library 单本导入未启用。设置 LAP_ALLOW_DEV_BOOK_IMPORT=true 并启用 DB persist guard。",
  ));

  return items;
}

function collectProblemApiStatus(): StatusItem[] {
  const contract = PROBLEM_API_CONTRACT;
  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
  });
  const unified = getUnifiedApiStatus(guard);

  const items: StatusItem[] = [];

  const problemStatus: StatusValue = guard.allowed ? "enabled" : (guard.missingEnvNames.length > 0 ? "missing-env" : "blocked");
  items.push(makeItem(
    "problem-api.guard",
    "Problem API Guard 状态",
    "problem-api",
    problemStatus,
    [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    [...guard.missingEnvNames],
    guard.allowed
      ? "Problem API 外部调用已启用（dev-only preview）。"
      : `Problem API 已阻止。原因：${guard.blockedReason ?? "missing env"}。`,
    unified.productionBlocked,
  ));

  items.push(makeItem(
    "problem-api.allow_external",
    "LAP_ALLOW_EXTERNAL_PROBLEM_API",
    "problem-api",
    safeGetEnv("LAP_ALLOW_EXTERNAL_PROBLEM_API") === "true" ? "enabled" : "missing-env",
    ["LAP_ALLOW_EXTERNAL_PROBLEM_API"],
    safeGetEnv("LAP_ALLOW_EXTERNAL_PROBLEM_API") === "true" ? ["LAP_ALLOW_EXTERNAL_PROBLEM_API"] : [],
    safeGetEnv("LAP_ALLOW_EXTERNAL_PROBLEM_API") === "true" ? [] : ["LAP_ALLOW_EXTERNAL_PROBLEM_API"],
    "允许外部 Problem API 调用开关。",
  ));

  items.push(makeItem(
    "problem-api.base_url",
    "LAP_PROBLEM_API_BASE_URL",
    "problem-api",
    typeof safeGetEnv("LAP_PROBLEM_API_BASE_URL") === "string" && safeGetEnv("LAP_PROBLEM_API_BASE_URL")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_PROBLEM_API_BASE_URL"],
    typeof safeGetEnv("LAP_PROBLEM_API_BASE_URL") === "string" && safeGetEnv("LAP_PROBLEM_API_BASE_URL")!.trim().length > 0 ? ["LAP_PROBLEM_API_BASE_URL"] : [],
    typeof safeGetEnv("LAP_PROBLEM_API_BASE_URL") === "string" && safeGetEnv("LAP_PROBLEM_API_BASE_URL")!.trim().length > 0 ? [] : ["LAP_PROBLEM_API_BASE_URL"],
    "Problem API 基础 URL（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "problem-api.api_key",
    "LAP_PROBLEM_API_KEY",
    "problem-api",
    typeof safeGetEnv("LAP_PROBLEM_API_KEY") === "string" && safeGetEnv("LAP_PROBLEM_API_KEY")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_PROBLEM_API_KEY"],
    typeof safeGetEnv("LAP_PROBLEM_API_KEY") === "string" && safeGetEnv("LAP_PROBLEM_API_KEY")!.trim().length > 0 ? ["LAP_PROBLEM_API_KEY"] : [],
    typeof safeGetEnv("LAP_PROBLEM_API_KEY") === "string" && safeGetEnv("LAP_PROBLEM_API_KEY")!.trim().length > 0 ? [] : ["LAP_PROBLEM_API_KEY"],
    "Problem API Key（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "problem-api.provider",
    "LAP_PROBLEM_API_PROVIDER",
    "problem-api",
    typeof safeGetEnv("LAP_PROBLEM_API_PROVIDER") === "string" && safeGetEnv("LAP_PROBLEM_API_PROVIDER")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_PROBLEM_API_PROVIDER"],
    typeof safeGetEnv("LAP_PROBLEM_API_PROVIDER") === "string" && safeGetEnv("LAP_PROBLEM_API_PROVIDER")!.trim().length > 0 ? ["LAP_PROBLEM_API_PROVIDER"] : [],
    typeof safeGetEnv("LAP_PROBLEM_API_PROVIDER") === "string" && safeGetEnv("LAP_PROBLEM_API_PROVIDER")!.trim().length > 0 ? [] : ["LAP_PROBLEM_API_PROVIDER"],
    "Problem API provider 标识。",
  ));

  // Import readiness
  items.push(makeItem(
    "problem-api.import_preview",
    "Problem Import Preview",
    "problem-api",
    guard.allowed ? "enabled" : "preview-only",
    guard.allowed ? [] : [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    guard.allowed ? [] : [...guard.missingEnvNames],
    guard.allowed
      ? "Problem API 就绪：Codeforces 搜索预览已接入 /problems 页面，单题导入已接入（dev-only，需 LAP_ALLOW_DEV_PROBLEM_IMPORT=true），支持关键词/标签/难度过滤和分页。"
      : "Problem API 未就绪，仅支持内建示例题。",
  ));

  items.push(makeItem(
    "problem-api.import_save",
    "Problem Import Save",
    "problem-api",
    safeGetEnv("LAP_ALLOW_DEV_PROBLEM_IMPORT") === "true" ? "enabled" : "preview-only",
    ["LAP_ALLOW_DEV_PROBLEM_IMPORT", "LAP_ALLOW_REAL_DB_INTEGRATION", "LAP_IMPORT_DB_PERSIST_DEV_ENABLED"],
    safeGetEnv("LAP_ALLOW_DEV_PROBLEM_IMPORT") === "true" ? ["LAP_ALLOW_DEV_PROBLEM_IMPORT"] : [],
    safeGetEnv("LAP_ALLOW_DEV_PROBLEM_IMPORT") === "true" ? [] : ["LAP_ALLOW_DEV_PROBLEM_IMPORT"],
    safeGetEnv("LAP_ALLOW_DEV_PROBLEM_IMPORT") === "true"
      ? "Codeforces 单题导入已启用（dev-only，需 DB integration）。在 /problems 页面 Codeforces 搜索结果中可用，不支持批量导入。"
      : "题目导入保存需要 LAP_ALLOW_DEV_PROBLEM_IMPORT=true（当前为 preview-only）。",
  ));

  return items;
}

function collectPhoneAuthStatus(): StatusItem[] {
  const contract = PHONE_AUTH_CONTRACT;
  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
  });
  const unified = getUnifiedApiStatus(guard);

  const items: StatusItem[] = [];

  const phoneStatus: StatusValue = guard.allowed ? "enabled" : (guard.missingEnvNames.length > 0 ? "missing-env" : "blocked");
  items.push(makeItem(
    "phone-auth.guard",
    "Phone Auth Guard 状态",
    "phone-auth",
    phoneStatus,
    [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    [...guard.missingEnvNames],
    guard.allowed
      ? "Phone Auth (SMS OTP) 已启用（dev-only preview）。"
      : `Phone Auth 已阻止。原因：${guard.blockedReason ?? "missing env"}。`,
    unified.productionBlocked,
  ));

  items.push(makeItem(
    "phone-auth.allow",
    "LAP_ALLOW_PHONE_AUTH",
    "phone-auth",
    safeGetEnv("LAP_ALLOW_PHONE_AUTH") === "true" ? "enabled" : "missing-env",
    ["LAP_ALLOW_PHONE_AUTH"],
    safeGetEnv("LAP_ALLOW_PHONE_AUTH") === "true" ? ["LAP_ALLOW_PHONE_AUTH"] : [],
    safeGetEnv("LAP_ALLOW_PHONE_AUTH") === "true" ? [] : ["LAP_ALLOW_PHONE_AUTH"],
    "手机号验证码登录开关。",
  ));

  items.push(makeItem(
    "phone-auth.provider",
    "LAP_SMS_PROVIDER",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_PROVIDER") === "string" && safeGetEnv("LAP_SMS_PROVIDER")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_PROVIDER"],
    typeof safeGetEnv("LAP_SMS_PROVIDER") === "string" && safeGetEnv("LAP_SMS_PROVIDER")!.trim().length > 0 ? ["LAP_SMS_PROVIDER"] : [],
    typeof safeGetEnv("LAP_SMS_PROVIDER") === "string" && safeGetEnv("LAP_SMS_PROVIDER")!.trim().length > 0 ? [] : ["LAP_SMS_PROVIDER"],
    "SMS provider 标识（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "phone-auth.base_url",
    "LAP_SMS_API_BASE_URL",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_API_BASE_URL") === "string" && safeGetEnv("LAP_SMS_API_BASE_URL")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_API_BASE_URL"],
    typeof safeGetEnv("LAP_SMS_API_BASE_URL") === "string" && safeGetEnv("LAP_SMS_API_BASE_URL")!.trim().length > 0 ? ["LAP_SMS_API_BASE_URL"] : [],
    typeof safeGetEnv("LAP_SMS_API_BASE_URL") === "string" && safeGetEnv("LAP_SMS_API_BASE_URL")!.trim().length > 0 ? [] : ["LAP_SMS_API_BASE_URL"],
    "SMS API 基础 URL（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "phone-auth.api_key",
    "LAP_SMS_API_KEY",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_API_KEY") === "string" && safeGetEnv("LAP_SMS_API_KEY")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_API_KEY"],
    typeof safeGetEnv("LAP_SMS_API_KEY") === "string" && safeGetEnv("LAP_SMS_API_KEY")!.trim().length > 0 ? ["LAP_SMS_API_KEY"] : [],
    typeof safeGetEnv("LAP_SMS_API_KEY") === "string" && safeGetEnv("LAP_SMS_API_KEY")!.trim().length > 0 ? [] : ["LAP_SMS_API_KEY"],
    "SMS API Key（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "phone-auth.api_secret",
    "LAP_SMS_API_SECRET",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_API_SECRET") === "string" && safeGetEnv("LAP_SMS_API_SECRET")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_API_SECRET"],
    typeof safeGetEnv("LAP_SMS_API_SECRET") === "string" && safeGetEnv("LAP_SMS_API_SECRET")!.trim().length > 0 ? ["LAP_SMS_API_SECRET"] : [],
    typeof safeGetEnv("LAP_SMS_API_SECRET") === "string" && safeGetEnv("LAP_SMS_API_SECRET")!.trim().length > 0 ? [] : ["LAP_SMS_API_SECRET"],
    "SMS API Secret（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "phone-auth.sign_name",
    "LAP_SMS_SIGN_NAME",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_SIGN_NAME") === "string" && safeGetEnv("LAP_SMS_SIGN_NAME")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_SIGN_NAME"],
    typeof safeGetEnv("LAP_SMS_SIGN_NAME") === "string" && safeGetEnv("LAP_SMS_SIGN_NAME")!.trim().length > 0 ? ["LAP_SMS_SIGN_NAME"] : [],
    typeof safeGetEnv("LAP_SMS_SIGN_NAME") === "string" && safeGetEnv("LAP_SMS_SIGN_NAME")!.trim().length > 0 ? [] : ["LAP_SMS_SIGN_NAME"],
    "短信签名名称（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "phone-auth.template_id",
    "LAP_SMS_TEMPLATE_ID",
    "phone-auth",
    typeof safeGetEnv("LAP_SMS_TEMPLATE_ID") === "string" && safeGetEnv("LAP_SMS_TEMPLATE_ID")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_SMS_TEMPLATE_ID"],
    typeof safeGetEnv("LAP_SMS_TEMPLATE_ID") === "string" && safeGetEnv("LAP_SMS_TEMPLATE_ID")!.trim().length > 0 ? ["LAP_SMS_TEMPLATE_ID"] : [],
    typeof safeGetEnv("LAP_SMS_TEMPLATE_ID") === "string" && safeGetEnv("LAP_SMS_TEMPLATE_ID")!.trim().length > 0 ? [] : ["LAP_SMS_TEMPLATE_ID"],
    "短信模板 ID（仅显示是否配置，不显示值）。",
  ));

  return items;
}

function collectEmailAuthStatus(): StatusItem[] {
  const contract = EMAIL_AUTH_CONTRACT;
  const guard = evaluateExternalApiDevGuard({
    providerLabel: contract.label,
    allowExternalEnvName: contract.allowEnvName,
    requiredEnvNames: contract.requiredEnvNames,
  });
  const unified = getUnifiedApiStatus(guard);

  const items: StatusItem[] = [];

  const emailStatus: StatusValue = guard.allowed ? "enabled" : (guard.missingEnvNames.length > 0 ? "missing-env" : "blocked");
  items.push(makeItem(
    "email-auth.guard",
    "Email Auth Guard 状态",
    "email-auth",
    emailStatus,
    [...guard.requiredEnvNames],
    [...guard.configuredEnvNames],
    [...guard.missingEnvNames],
    guard.allowed
      ? "Email Auth 已启用（dev-only preview）。"
      : `Email Auth 已阻止。原因：${guard.blockedReason ?? "missing env"}。`,
    unified.productionBlocked,
  ));

  items.push(makeItem(
    "email-auth.allow",
    "LAP_ALLOW_EMAIL_AUTH",
    "email-auth",
    safeGetEnv("LAP_ALLOW_EMAIL_AUTH") === "true" ? "enabled" : "missing-env",
    ["LAP_ALLOW_EMAIL_AUTH"],
    safeGetEnv("LAP_ALLOW_EMAIL_AUTH") === "true" ? ["LAP_ALLOW_EMAIL_AUTH"] : [],
    safeGetEnv("LAP_ALLOW_EMAIL_AUTH") === "true" ? [] : ["LAP_ALLOW_EMAIL_AUTH"],
    "邮箱登录开关。",
  ));

  items.push(makeItem(
    "email-auth.provider",
    "LAP_EMAIL_PROVIDER",
    "email-auth",
    typeof safeGetEnv("LAP_EMAIL_PROVIDER") === "string" && safeGetEnv("LAP_EMAIL_PROVIDER")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_EMAIL_PROVIDER"],
    typeof safeGetEnv("LAP_EMAIL_PROVIDER") === "string" && safeGetEnv("LAP_EMAIL_PROVIDER")!.trim().length > 0 ? ["LAP_EMAIL_PROVIDER"] : [],
    typeof safeGetEnv("LAP_EMAIL_PROVIDER") === "string" && safeGetEnv("LAP_EMAIL_PROVIDER")!.trim().length > 0 ? [] : ["LAP_EMAIL_PROVIDER"],
    "Email provider 标识（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "email-auth.base_url",
    "LAP_EMAIL_API_BASE_URL",
    "email-auth",
    typeof safeGetEnv("LAP_EMAIL_API_BASE_URL") === "string" && safeGetEnv("LAP_EMAIL_API_BASE_URL")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_EMAIL_API_BASE_URL"],
    typeof safeGetEnv("LAP_EMAIL_API_BASE_URL") === "string" && safeGetEnv("LAP_EMAIL_API_BASE_URL")!.trim().length > 0 ? ["LAP_EMAIL_API_BASE_URL"] : [],
    typeof safeGetEnv("LAP_EMAIL_API_BASE_URL") === "string" && safeGetEnv("LAP_EMAIL_API_BASE_URL")!.trim().length > 0 ? [] : ["LAP_EMAIL_API_BASE_URL"],
    "Email API 基础 URL（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "email-auth.api_key",
    "LAP_EMAIL_API_KEY",
    "email-auth",
    typeof safeGetEnv("LAP_EMAIL_API_KEY") === "string" && safeGetEnv("LAP_EMAIL_API_KEY")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_EMAIL_API_KEY"],
    typeof safeGetEnv("LAP_EMAIL_API_KEY") === "string" && safeGetEnv("LAP_EMAIL_API_KEY")!.trim().length > 0 ? ["LAP_EMAIL_API_KEY"] : [],
    typeof safeGetEnv("LAP_EMAIL_API_KEY") === "string" && safeGetEnv("LAP_EMAIL_API_KEY")!.trim().length > 0 ? [] : ["LAP_EMAIL_API_KEY"],
    "Email API Key（仅显示是否配置，不显示值）。",
  ));

  items.push(makeItem(
    "email-auth.from",
    "LAP_EMAIL_FROM",
    "email-auth",
    typeof safeGetEnv("LAP_EMAIL_FROM") === "string" && safeGetEnv("LAP_EMAIL_FROM")!.trim().length > 0 ? "enabled" : "missing-env",
    ["LAP_EMAIL_FROM"],
    typeof safeGetEnv("LAP_EMAIL_FROM") === "string" && safeGetEnv("LAP_EMAIL_FROM")!.trim().length > 0 ? ["LAP_EMAIL_FROM"] : [],
    typeof safeGetEnv("LAP_EMAIL_FROM") === "string" && safeGetEnv("LAP_EMAIL_FROM")!.trim().length > 0 ? [] : ["LAP_EMAIL_FROM"],
    "邮件发送方地址（仅显示是否配置，不显示值）。",
  ));

  // Optional SMTP envs
  const smtpHost = safeGetEnv("LAP_SMTP_HOST");
  const smtpPort = safeGetEnv("LAP_SMTP_PORT");
  const smtpUser = safeGetEnv("LAP_SMTP_USER");
  const smtpPass = safeGetEnv("LAP_SMTP_PASS");
  const smtpConfigured = [smtpHost, smtpPort, smtpUser, smtpPass].filter(
    (v) => typeof v === "string" && v.trim().length > 0,
  ).length;

  items.push(makeItem(
    "email-auth.smtp",
    "SMTP 配置（可选）",
    "email-auth",
    smtpConfigured >= 2 ? "enabled" : "blocked",
    ["LAP_SMTP_HOST", "LAP_SMTP_PORT", "LAP_SMTP_USER", "LAP_SMTP_PASS"],
    [smtpHost, smtpPort, smtpUser, smtpPass].filter(
      (v) => typeof v === "string" && v.trim().length > 0,
    ).map((_, i) => ["LAP_SMTP_HOST", "LAP_SMTP_PORT", "LAP_SMTP_USER", "LAP_SMTP_PASS"][i]),
    smtpConfigured >= 2
      ? []
      : ["LAP_SMTP_HOST", "LAP_SMTP_PORT", "LAP_SMTP_USER", "LAP_SMTP_PASS"],
    smtpConfigured >= 2
      ? "SMTP 配置已部分就绪（可选）。"
      : "SMTP 配置未就绪（可选，API 模式优先）。",
    false,
  ));

  // A468/A471: Email OTP storage/model readiness
  const otpGuard = getEmailOtpGuardStatus();
  items.push(makeItem(
    "email-auth.otp_storage",
    "Email OTP 存储/模型就绪",
    "email-auth",
    otpGuard.otpStorageAllowed ? "enabled" : "blocked",
    otpGuard.requiredEnvNames,
    otpGuard.configuredEnvNames,
    otpGuard.missingEnvNames,
    otpGuard.otpStorageAllowed
      ? "Email OTP 数据模型和存储层已就绪（A468 v1）。User.emailVerifiedAt + EmailOtpCode 模型已添加，OTP hash/verify helper 已可用。"
      : `Email OTP 存储已阻止。原因：${otpGuard.reason}`,
    otpGuard.productionBlocked,
  ));
  items.push(makeItem(
    "email-auth.otp_guard",
    "Email OTP Guard 状态",
    "email-auth",
    otpGuard.enabled ? "enabled" : "blocked",
    [otpGuard.provider === "resend" ? "LAP_ALLOW_DEV_EMAIL_OTP" : "..."],
    otpGuard.configuredEnvNames,
    otpGuard.missingEnvNames,
    `Provider: ${otpGuard.provider}。sendsEmail: ${otpGuard.sendsEmail}。otpStorage: ${otpGuard.otpStorageAllowed}。A471 真实发送已接入。`,
    otpGuard.productionBlocked,
  ));
  items.push(makeItem(
    "email-auth.sends_email",
    "邮件发送状态",
    "email-auth",
    otpGuard.sendsEmail ? "enabled" : "preview-only",
    ["LAP_ALLOW_DEV_EMAIL_SEND", "LAP_EMAIL_API_KEY", "LAP_EMAIL_FROM"],
    otpGuard.sendsEmail ? ["LAP_ALLOW_DEV_EMAIL_SEND"] : [],
    otpGuard.sendsEmail ? [] : ["LAP_ALLOW_DEV_EMAIL_SEND"],
    otpGuard.sendsEmail
      ? "Resend API 真实邮件发送已启用（A471）。"
      : "邮件发送未启用 — 验证码将打印到服务端控制台。设置 LAP_ALLOW_DEV_EMAIL_SEND=true + LAP_EMAIL_API_KEY + LAP_EMAIL_FROM 启用真实邮件。",
    false,
  ));

  return items;
}

function collectDbStatus(): StatusItem[] {
  const items: StatusItem[] = [];

  const allowRealDb = safeGetEnv("LAP_ALLOW_REAL_DB_INTEGRATION") === "true";
  const hasDbUrl = safeHasDbUrl();

  items.push(makeItem(
    "db.allow_real",
    "LAP_ALLOW_REAL_DB_INTEGRATION",
    "db",
    allowRealDb ? "enabled" : "missing-env",
    ["LAP_ALLOW_REAL_DB_INTEGRATION"],
    allowRealDb ? ["LAP_ALLOW_REAL_DB_INTEGRATION"] : [],
    allowRealDb ? [] : ["LAP_ALLOW_REAL_DB_INTEGRATION"],
    "是否允许真实数据库集成。",
  ));

  items.push(makeItem(
    "db.url_present",
    "DATABASE_URL 是否配置",
    "db",
    hasDbUrl ? "enabled" : "missing-env",
    ["DATABASE_URL"],
    hasDbUrl ? ["DATABASE_URL"] : [],
    hasDbUrl ? [] : ["DATABASE_URL"],
    "DATABASE_URL 环境变量是否已配置（仅显示布尔状态，不显示值）。",
  ));

  items.push(makeItem(
    "db.overall_readiness",
    "DB 整体就绪状态",
    "db",
    allowRealDb && hasDbUrl ? "enabled" : "blocked",
    [],
    [],
    [],
    allowRealDb && hasDbUrl
      ? "数据库已配置并允许集成（dev-only preview）。"
      : "数据库未完全就绪。",
  ));

  return items;
}

function collectAgentMcpStatus(): StatusItem[] {
  // PDF import guard — real status, dynamic based on env
  const pdfGuard = evaluatePdfImportGuard();
  const pdfStatus: StatusValue = pdfGuard.enabled ? "enabled" : "blocked";

  // DOCX import guard — real status, dynamic based on env
  const docxGuard = evaluateDocxImportGuard();
  const docxStatus: StatusValue = docxGuard.enabled ? "enabled" : "blocked";

  return [
    makeItem("agent-mcp.agent", "Agent 能力", "agent-mcp", "preview-only", [], [], [], "Agent 能力当前为 preview-only，未启用真实 agent loop。"),
    makeItem("agent-mcp.mcp", "MCP 连接器", "agent-mcp", "preview-only", [], [], [], "MCP 连接器当前为占位 scaffold，未连接真实服务。"),
    makeItem("agent-mcp.github", "GitHub 集成", "agent-mcp", "unavailable", [], [], [], "GitHub 集成未启用。不调用真实 GitHub API。"),
    makeItem("agent-mcp.tools", "工具执行", "agent-mcp", "preview-only", [], [], [], "所有工具（shell/file/network）均为 preview-only 或 disabled，不执行真实操作。"),
    makeItem("agent-mcp.skill_community", "Skill 社区", "agent-mcp", "preview-only", [], [], [], "Skill 社区仅保留占位 scaffold，不可真实安装或执行。"),
    makeItem("agent-mcp.provider", "AI Provider", "agent-mcp", "preview-only", [], [], [], "AI Provider 不调用真实模型，所有调用通过 dev guard 控制。"),

    makeItem(
      "import.format.pdf",
      "PDF 导入",
      "import",
      pdfStatus,
      pdfGuard.requiredEnvNames,
      pdfGuard.configuredEnvNames,
      pdfGuard.missingEnvNames,
      pdfGuard.enabled
        ? "PDF 纯文本提取已启用（dev-only preview）。仅纯文本提取，不支持扫描件 OCR，不调用 LLM。"
        : `PDF 导入已阻止。${pdfGuard.reason}`,
      pdfGuard.productionBlocked,
    ),
    makeItem(
      "import.format.docx",
      "DOCX 导入",
      "import",
      docxStatus,
      docxGuard.requiredEnvNames,
      docxGuard.configuredEnvNames,
      docxGuard.missingEnvNames,
      docxGuard.enabled
        ? "DOCX 纯文本提取已启用（dev-only preview）。仅纯文本提取，不保留样式/图片/批注，不调用 LLM。"
        : `DOCX 导入已阻止。${docxGuard.reason}`,
      docxGuard.productionBlocked,
    ),
    makeItem(
      "import.format.epub",
      "EPUB 导入",
      "import",
      "unavailable",
      [],
      [],
      [],
      "EPUB 解析尚未实现，当前不处理 EPUB 文件。后续版本接入。",
    ),

  ];
}

function collectImportStatus(): StatusItem[] {
  return [
    makeItem("import.book_preview", "Book Import Preview", "import", "preview-only", [], [], [], "书籍导入预览，需 Book API guard + dev import env 通过。"),
    makeItem("import.problem_preview", "Problem Import Preview", "import", "preview-only", [], [], [], "题目导入预览，需 Problem API guard + dev import env 通过。"),
  ];
}

// ---------------------------------------------------------------------------
// Snapshot assembler
// ---------------------------------------------------------------------------

/** Assemble all subsystem status items into the full read-only snapshot. */
export function getAdminStatusSnapshot(): AdminStatusSnapshot {
  const items: StatusItem[] = [
    ...collectLlmStatus(),
    ...collectBookApiStatus(),
    ...collectProblemApiStatus(),
    ...collectPhoneAuthStatus(),
    ...collectEmailAuthStatus(),
    ...collectDbStatus(),
    ...collectAgentMcpStatus(),
    ...collectImportStatus(),
  ];

  const summary = computeSummary(items);

  const groups: StatusGroup[] = [
    { label: "AI Assistant", items: items.filter((i) => i.category === "llm") },
    { label: "External APIs", items: items.filter((i) => i.category === "book-api" || i.category === "problem-api" || i.category === "phone-auth" || i.category === "email-auth") },
    { label: "Database", items: items.filter((i) => i.category === "db") },
    { label: "Imports", items: items.filter((i) => i.category === "import") },
    { label: "Agent Preview", items: items.filter((i) => i.category === "agent-mcp") },
    { label: "UI Shell", items: items.filter((i) => i.category === "ui-shell") },
  ];

  return {
    items,
    groups,
    summary,
    productionReady: false as const,
    safeToExposeToClient: true as const,
  };
}
