/**
 * Reader AI QA Server Action
 *
 * Receives bookId/chapterId/question, returns safe result.
 *
 * Flow:
 * 1. Read current reader data
 * 2. Build safe context
 * 3. Evaluate guard
 * 4. Select provider via provider selection module
 * 5. Call provider and return safe result (no DB write, no raw prompt/response)
 *
 * Designation: dev preview / dev-only / mock default / no DB / no production AI
 *
 * @module reader-ai-qa-server-action
 * @previewOnly
 */

"use server";

import type { LlmChatMessage, LlmChatResult } from "../../../../../packages/ai-core/src/llm/llm-provider-contract.ts";
import { LlmChatRole } from "../../../../../packages/ai-core/src/llm/llm-provider-contract.ts";
import type { ReaderAiQaGuardEnv } from "./reader-ai-qa-guard.ts";
import { evaluateReaderAiQaGuard } from "./reader-ai-qa-guard.ts";
import {
  buildReaderAiQaContext,
  READER_AI_QA_LIMITS,
  type ReaderAiQaSafeContext,
} from "./reader-ai-qa-context.ts";
import {
  selectReaderQaProvider,
  type ReaderQaProviderMode,
} from "./reader-qa-provider-selection.ts";
import type { ExternalProviderFetch } from "../../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts";
import { loadExternalProviderConfig } from "../../../../../packages/ai-core/src/llm/external-chat-completions-provider.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReaderAiQaServerActionInput {
  bookId: string;
  chapterId: string;
  question: string;
  bookTitle: string;
  chapterTitle: string;
  chapterContent: string;
  codeBlockSummaries?: readonly string[];
}

export interface ReaderAiQaServerActionResult {
  success: boolean;
  answerPreview: string;
  providerMode: ReaderQaProviderMode;
  realProviderCalled: boolean;
  devOnly: true;
  productionReady: false;
  blockedReasons: readonly string[];
  safeToExposeToClient: {
    guardMode: string;
    guardNotice: string;
    guardSourceLabel: string;
    contextUsed: boolean;
    contextTruncated: boolean;
    sensitiveFieldsDetected: boolean;
    charCounts: ReaderAiQaSafeContext["charCounts"] | null;
    providerSelectionLabel: string;
  };
  warnings: readonly string[];
}

// ---------------------------------------------------------------------------
// Server action
// ---------------------------------------------------------------------------

export async function readerAiQaServerAction(
  input: ReaderAiQaServerActionInput,
  _guardEnv?: ReaderAiQaGuardEnv,
  _customFetch?: ExternalProviderFetch,
): Promise<ReaderAiQaServerActionResult> {
  const { bookId: _bookId, chapterId: _chapterId } = input;

  // Step 1: Validate question
  if (!input.question || input.question.trim().length === 0) {
    return createBlockedResult(
      ["Problem cannot be empty."],
      makeClientInfo("blocked", "blocked", "blocked", false, false, false, null, "blocked"),
    );
  }

  if (input.question.trim().length > READER_AI_QA_LIMITS.MAX_QUESTION_CHARS) {
    return createBlockedResult(
      ["Question too long: " + input.question.length + " chars, limit: " + READER_AI_QA_LIMITS.MAX_QUESTION_CHARS],
      makeClientInfo("blocked", "blocked", "blocked", false, false, false, null, "blocked"),
    );
  }

  // Step 2: Build safe context
  const contextResult = buildReaderAiQaContext({
    bookTitle: input.bookTitle,
    chapterTitle: input.chapterTitle,
    chapterContent: input.chapterContent,
    codeBlockSummaries: input.codeBlockSummaries,
    userQuestion: input.question,
  });

  if (!contextResult.context) {
    return createBlockedResult(
      [contextResult.blockedReason ?? "Context build failed."],
      makeClientInfo("blocked", "blocked", "blocked", false, false, false, null, "blocked"),
    );
  }

  const context = contextResult.context;

  // Step 3: Evaluate guard
  const guardEnv = _guardEnv ?? readGuardEnv();
  const guardResult = evaluateReaderAiQaGuard(guardEnv);

  // Step 4: Select provider via provider selection module
  const externalConfig = loadExternalProviderConfig({
    endpoint: guardEnv.LAP_LLM_DEV_ENDPOINT,
    apiKey: guardEnv.LAP_LLM_DEV_API_KEY,
    model: guardEnv.LAP_LLM_DEV_MODEL,
  });

  const selection = await selectReaderQaProvider({
    guardResult,
    externalConfig,
    customFetch: _customFetch,
  });

  // If provider selection resulted in blocked -> return blocked
  if (selection.providerMode === "blocked") {
    return createBlockedResult(
      [...guardResult.blockedReasons],
      makeClientInfo(
        guardResult.mode,
        guardResult.notice,
        guardResult.sourceLabel,
        true,
        context.chapterTruncated,
        context.sensitiveFieldsDetected,
        context.charCounts,
        selection.selectionLabel,
      ),
    );
  }

  // Step 5: Build LLM messages and call provider
  const messages = buildLlmMessages(context);

  let llmResult: LlmChatResult;
  try {
    llmResult = await selection.provider!.generate({
      messages,
      maxInputChars: READER_AI_QA_LIMITS.MAX_TOTAL_INPUT_CHARS,
      maxOutputChars: 4096,
      purposeSummary: selection.providerMode === "external-dev-preview"
        ? "Reader chapter QA (dev-only external provider)"
        : "Reader chapter QA (mock provider)",
    });
  } catch {
    llmResult = {
      ok: false,
      answerSummary: "[error] Provider call failed unexpectedly.",
      providerMode: "mock" as const,
      realProviderCalled: false,
      networkAccessed: false,
      secretSafe: true,
      rawPromptStored: false,
      rawResponseStored: false,
      devOnly: true,
      productionReady: false,
      warnings: ["Provider call threw. No raw details retained."],
      createdAt: new Date().toISOString(),
    };
  }

  // Step 6: Determine final providerMode
  let finalProviderMode: ReaderQaProviderMode;
  if (llmResult.ok) {
    finalProviderMode = selection.providerMode;
  } else if (selection.providerMode === "external-dev-preview" && !llmResult.ok) {
    finalProviderMode = "fallback";
  } else {
    finalProviderMode = selection.providerMode;
  }

  // Step 7: Return safe result
  return {
    success: llmResult.ok,
    answerPreview: llmResult.answerSummary,
    providerMode: finalProviderMode,
    realProviderCalled: llmResult.realProviderCalled,
    devOnly: true,
    productionReady: false,
    blockedReasons: [...guardResult.blockedReasons],
    safeToExposeToClient: makeClientInfo(
      guardResult.mode,
      guardResult.notice,
      guardResult.sourceLabel,
      true,
      context.chapterTruncated,
      context.sensitiveFieldsDetected,
      context.charCounts,
      selection.selectionLabel,
    ),
    warnings: [
      ...guardResult.blockedReasons.map((r) => "guard: " + r),
      ...(context.sensitiveFieldsDetected
        ? ["Sensitive fields detected and redacted: " + context.detectedPatterns.join(", ")]
        : []),
      "provider selection: " + selection.selectionLabel,
      "llmUsed: " + selection.llmUsed + ", externalProviderUsed: " + selection.externalProviderUsed,
      ...llmResult.warnings,
      "Dev preview - no raw prompt/response saved - no DB write - no tool execution",
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClientInfo(
  guardMode: string,
  guardNotice: string,
  guardSourceLabel: string,
  contextUsed: boolean,
  contextTruncated: boolean,
  sensitiveFieldsDetected: boolean,
  charCounts: ReaderAiQaSafeContext["charCounts"] | null,
  providerSelectionLabel: string,
) {
  return {
    guardMode,
    guardNotice,
    guardSourceLabel,
    contextUsed,
    contextTruncated,
    sensitiveFieldsDetected,
    charCounts,
    providerSelectionLabel,
  };
}

function readGuardEnv(): ReaderAiQaGuardEnv {
  return {
    LAP_READER_AI_QA_DEV_ENABLED: process.env.LAP_READER_AI_QA_DEV_ENABLED,
    LAP_LLM_DEV_PROVIDER_ENABLED: process.env.LAP_LLM_DEV_PROVIDER_ENABLED,
    LAP_LLM_DEV_ENDPOINT: process.env.LAP_LLM_DEV_ENDPOINT,
    LAP_LLM_DEV_API_KEY: process.env.LAP_LLM_DEV_API_KEY,
    LAP_LLM_DEV_MODEL: process.env.LAP_LLM_DEV_MODEL,
  };
}

function buildLlmMessages(context: ReaderAiQaSafeContext): LlmChatMessage[] {
  const systemPrompt = "You are a programming learning assistant. " +
    "Answer the user's question based on the chapter content. " +
    "Book: " + context.bookTitle + ". Chapter: " + context.chapterTitle + ". " +
    "Requirements: use Chinese, reference specific code/concepts, " +
    "honestly state if question is out of scope, no harmful code suggestions.";

  const userPrompt = "Chapter content reference:\n" + context.chapterExcerpt +
    "\n\nQuestion: " + context.userQuestion;

  return [
    { role: LlmChatRole.System, content: systemPrompt },
    { role: LlmChatRole.User, content: userPrompt },
  ];
}

function createBlockedResult(
  reasons: readonly string[],
  clientInfo: ReaderAiQaServerActionResult["safeToExposeToClient"],
): ReaderAiQaServerActionResult {
  return {
    success: false,
    answerPreview: "[blocked] " + reasons.join("; "),
    providerMode: "blocked",
    realProviderCalled: false,
    devOnly: true,
    productionReady: false,
    blockedReasons: reasons,
    safeToExposeToClient: clientInfo,
    warnings: [
      ...reasons.map((r) => "reason: " + r),
      "Dev preview - no raw prompt/response saved - no DB write - no tool execution",
    ],
  };
}
