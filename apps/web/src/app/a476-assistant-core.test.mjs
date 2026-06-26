import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ROOT = process.cwd();

function read(path) {
  return readFileSync(ROOT + path, "utf-8");
}

describe("A476 assistant core", function () {
  it("AssistantPageContextProvider exists and tracks pathname", function () {
    const src = read("/apps/web/src/app/_components/AssistantPageContextProvider.tsx");
    assert.ok(src.includes("usePathname"));
    assert.ok(src.includes("createSafeAssistantPageContext"));
    assert.ok(src.includes("mergeAssistantPageContext"));
  });

  it("AssistantConversationStore persists draft and messages across routes", function () {
    const src = read("/apps/web/src/app/_components/AssistantConversationStore.tsx");
    assert.ok(src.includes("localStorage"));
    assert.ok(src.includes("draftQuestion"));
    assert.ok(src.includes("messages"));
    assert.ok(src.includes("conversationId"));
    assert.ok(src.includes("resetConversation"));
  });

  it("Floating assistant uses shared chat panel and browser safety hooks", function () {
    const src = read("/apps/web/src/app/_components/FloatingAiAssistant.tsx");
    assert.ok(src.includes("AssistantChatPanel"));
    assert.ok(src.includes('startsWith("/admin")'));
    assert.ok(src.includes("Escape"));
    assert.ok(src.includes("mousedown"));
    assert.ok(src.includes("clamp"));
  });

  it("/ai page wires workspace + safety sections", function () {
    const src = read("/apps/web/src/app/ai/page.tsx");
    assert.ok(src.includes("AssistantWorkspaceClient"));
    assert.ok(src.includes("AssistantPageContextProvider"));
    assert.ok(src.includes("LlmDevProviderTable"));
    assert.ok(src.includes("GuardDetailTable"));
    assert.ok(src.includes("Capabilities"));
    assert.ok(src.includes("memory-management"));
  });

  it("Assistant workspace exposes memory overview and manual memory management", function () {
    const src = read("/apps/web/src/app/ai/AssistantWorkspaceClient.tsx");
    assert.ok(src.includes("AssistantMemoryOverviewPanel"));
    assert.ok(src.includes("AssistantMemoryManager"));
    assert.ok(src.includes("聊天与记忆概览"));
    assert.ok(src.includes("min(78vh, 760px)"));
  });

  it("Articles page renders the article library client", function () {
    const src = read("/apps/web/src/app/articles/page.tsx");
    assert.ok(src.includes("loadArticleLibrary"));
    assert.ok(src.includes("ArticleLibraryClient"));
    assert.ok(src.includes("技术文章"));
  });

  it("Article library client keeps assistant context aligned with current page", function () {
    const src = read("/apps/web/src/app/articles/components/ArticleLibraryClient.tsx");
    assert.ok(src.includes("useAssistantPageContextUpdater"));
    assert.ok(src.includes("Current page shows"));
    assert.ok(src.includes("visibleItems"));
  });

  it("Assistant orchestrator validates internal navigation and memory summary", function () {
    const src = read("/apps/web/src/lib/assistant/assistant-orchestrator.ts");
    assert.ok(src.includes("navigate_internal"));
    assert.ok(src.includes("verifyProblemRoute"));
    assert.ok(src.includes("buildAssistantMemoryContext"));
    assert.ok(src.includes("MEMORY_CONTEXT"));
    assert.ok(src.includes("recentReadingSummary"));
    assert.ok(src.includes("Do not invent article titles"));
    assert.ok(src.includes("runAssistantOrchestrator"));
    assert.ok(src.includes("shouldAllowAssistantRoute"));
    assert.ok(src.includes("VISIBLE_ITEMS"));
    assert.ok(src.includes("/user/recent-practice"));
  });

  it("Article recommendation is grounded in current page items", function () {
    const src = read("/apps/web/src/lib/assistant/assistant-orchestrator.ts");
    assert.ok(src.includes("maybeBuildArticleRecommendationResponse"));
    assert.ok(src.includes("no visible article items in page context"));
    assert.ok(src.includes("pickBestVisibleArticle"));
  });

  it("Page context recognizes user subpages and route allowlist covers them", function () {
    const src = read("/apps/web/src/lib/assistant/page-context.ts");
    assert.ok(src.includes('route.startsWith("/user/")'));
    assert.ok(src.includes("/user/recent-reading"));
    assert.ok(src.includes("/user/ai-history"));
  });

  it("Assistant chat panel sends local practice context", function () {
    const src = read("/apps/web/src/app/_components/AssistantChatPanel.tsx");
    assert.ok(src.includes("loadRecentPractice"));
    assert.ok(src.includes("buildLocalLearningContext"));
    assert.ok(src.includes("recentRouteHint"));
  });

  it("Assistant server actions expose a read-only memory overview", function () {
    const src = read("/apps/web/src/lib/assistant/assistant-server-actions.ts");
    assert.ok(src.includes("listAssistantMemoryOverviewAction"));
    assert.ok(src.includes("includeInternal: true"));
  });

  it("Memory repository exists and supports owner-scoped CRUD", function () {
    const src = read("/packages/db/src/repositories/memory-repository.ts");
    assert.ok(src.includes("PrismaMemoryRepository"));
    assert.ok(src.includes("listMemoriesByOwner"));
    assert.ok(src.includes("addMemory"));
    assert.ok(src.includes("toggleMemoryEnabled"));
    assert.ok(src.includes("deleteMemory"));
    assert.ok(src.includes("MAX_MEMORIES_PER_USER"));
    assert.ok(src.includes("MAX_MEMORY_CONTENT_LENGTH"));
  });

  it("Legacy webAiServerAction delegates to the shared orchestrator", function () {
    const src = read("/apps/web/src/lib/web-ai-server-action.ts");
    assert.ok(src.includes("runAssistantOrchestrator"));
    assert.ok(src.includes("createSafeAssistantPageContext"));
    assert.ok(src.includes("AssistantPageType"));
  });

  it("Problem detail loader exposes safe fields for assistant context", function () {
    const src = read("/apps/web/src/app/problems/problem-detail-loader.ts");
    assert.ok(src.includes("DbProblemDetailView"));
    assert.ok(src.includes("safeToExposeToClient"));
    assert.ok(src.includes("tags"));
  });
});
