"use server";

import { readAssistantSession } from "./assistant/assistant-session.ts";
import { runAssistantOrchestrator } from "./assistant/assistant-orchestrator.ts";
import { createSafeAssistantPageContext } from "./assistant/page-context.ts";
import type { AssistantPageType } from "./assistant/assistant-types.ts";

export async function webAiServerAction(
  input: {
    question: string;
    pageContext: {
      currentPath: string;
      pageTitle: string;
      pageType: string;
    };
    userDataSummary?: unknown;
  },
  guardEnvArg?: Record<string, string | undefined>,
  customFetch?: typeof fetch,
) {
  const session = await readAssistantSession();
  const response = await runAssistantOrchestrator(
    {
      question: input.question,
      pageContext: createSafeAssistantPageContext(input.pageContext.currentPath, {
        route: input.pageContext.currentPath,
        title: input.pageContext.pageTitle,
        pageType: mapLegacyPageType(input.pageContext.pageType),
      }),
      userId: session.userId,
      learningContext: {
        userLabel: session.displayName ?? undefined,
        hasSession: session.hasSession,
        recentPracticeCount: 0,
        recentProblemIds: [],
        recentAttemptSummary: "",
        recentWrongBookSummary: "",
        recentReadingSummary: "",
        learningGoalSummary: "",
      },
    },
    {
      guardEnv: guardEnvArg,
      customFetch,
    },
  );

  return {
    success: response.state === "ok",
    answerPreview: response.message,
    providerMode: response.providerMode,
    sources: response.sources,
    usedTools: response.usedTools,
    realProviderCalled: response.providerMode === "real",
    devOnly: true,
    productionReady: false,
    blockedReasons: response.blockedReasons.map(mapLegacyBlockedReason),
    detectedIntent: "generalQuestion",
    intentLabel: "generic",
    safeToExposeToClient: {
      guardMode: response.providerMode === "real" ? "external_dev" : "blocked",
      guardNotice: response.state === "ok" ? "assistant core ready" : "assistant core blocked",
      guardSourceLabel: response.providerMode,
      missingEnvKeys: [],
      contextUsed: response.safeToExposeToClient.pageContextUsed,
      contextTruncated: false,
      sensitiveFieldsDetected: false,
      charCounts: null,
      providerSelectionLabel: response.providerMode,
      pageType: input.pageContext.pageType,
      currentPath: input.pageContext.currentPath,
    },
    warnings: response.warnings,
    assistantResponse: response,
  };
}

function mapLegacyPageType(pageType: string): AssistantPageType {
  switch (pageType) {
    case "home":
      return "home";
    case "articles":
      return "articles";
    case "books":
      return "books";
    case "book_detail":
    case "bookDetail":
      return "book_detail";
    case "reader":
      return "reader";
    case "problems":
      return "problems";
    case "problem_detail":
    case "problemDetail":
      return "problem_detail";
    case "user":
      return "user";
    case "import":
      return "import";
    case "learning":
      return "learning";
    case "ask":
      return "ask";
    case "article_list":
      return "article_list";
    case "article_detail":
      return "article_detail";
    default:
      return "unknown";
  }
}

function mapLegacyBlockedReason(reason: string): string {
  switch (reason) {
    case "question_empty":
      return "question empty";
    case "question_too_long":
      return "question too long";
    default:
      return reason;
  }
}
