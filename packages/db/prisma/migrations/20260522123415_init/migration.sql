-- CreateEnum
CREATE TYPE "BookSourceType" AS ENUM ('BUILTIN', 'IMPORTED_TEXT', 'IMPORTED_MARKDOWN', 'IMPORTED_URL');

-- CreateEnum
CREATE TYPE "ProblemDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ProblemAttemptStatus" AS ENUM ('ATTEMPTED', 'SOLVED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ProblemAttemptCorrectness" AS ENUM ('UNKNOWN', 'CORRECT', 'INCORRECT', 'PARTIAL');

-- CreateEnum
CREATE TYPE "AgentSessionContextType" AS ENUM ('BOOK_READING', 'GENERAL_AGENT', 'SKILL_CREATION', 'PROBLEM_PRACTICE');

-- CreateEnum
CREATE TYPE "AgentMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('PROFILE', 'SESSION_SUMMARY', 'RETRIEVABLE');

-- CreateEnum
CREATE TYPE "SkillRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SkillStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AutonomyLevel" AS ENUM ('ANSWER_ONLY', 'CONFIRM_ALL', 'AUTO_READ_LOW', 'AUTO_WRITE_LOW', 'HIGH_AUTONOMY');

-- CreateEnum
CREATE TYPE "ToolRiskLevel" AS ENUM ('READ_LOW', 'WRITE_LOW', 'NETWORK', 'CREDENTIAL', 'DESTRUCTIVE', 'EXTERNAL_PUBLISH', 'BACKGROUND_LONG_RUNNING');

-- CreateEnum
CREATE TYPE "ChapterQaAnswerSource" AS ENUM ('MOCK', 'REAL_OPENAI', 'FALLBACK_MOCK');

-- CreateEnum
CREATE TYPE "ChapterQaFeedbackRating" AS ENUM ('HELPFUL', 'UNHELPFUL', 'NEUTRAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authProvider" TEXT,
    "authProviderId" TEXT,
    "email" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "sourceType" "BookSourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "author" TEXT,
    "description" TEXT,
    "sourceUrl" TEXT,
    "language" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookChapter" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "parentId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookChapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentChunk" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "orderIndex" INTEGER NOT NULL,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "lastChunkId" TEXT,
    "progressRatio" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterQaHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "answerSource" "ChapterQaAnswerSource" NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerLabel" TEXT NOT NULL,
    "requestedProviderMode" TEXT NOT NULL,
    "resolvedProviderMode" TEXT NOT NULL,
    "modelConfigured" BOOLEAN NOT NULL,
    "networkUsed" BOOLEAN NOT NULL,
    "fallbackUsed" BOOLEAN NOT NULL,
    "fallbackReason" TEXT,
    "errorCategory" TEXT,
    "contextSummary" JSONB,
    "contextChunkRange" JSONB,
    "feedbackRating" "ChapterQaFeedbackRating",
    "feedbackNote" VARCHAR(1000),
    "feedbackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterQaHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAbilityProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "languageFundamentalsScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "algorithmScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "debuggingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engineeringPracticeScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "systemDesignScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAbilityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "difficulty" "ProblemDifficulty" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "sourceUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT,
    "externalProblemId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "status" "ProblemAttemptStatus" NOT NULL DEFAULT 'ATTEMPTED',
    "correctness" "ProblemAttemptCorrectness" NOT NULL DEFAULT 'UNKNOWN',
    "difficulty" "ProblemDifficulty",
    "topicTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timeSpentSeconds" INTEGER,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "recommendationDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT,
    "chapterId" TEXT,
    "contextType" "AgentSessionContextType" NOT NULL,
    "title" TEXT,
    "metadata" JSONB,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" "AgentMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "taskText" TEXT NOT NULL,
    "taskSummary" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user',
    "mode" TEXT NOT NULL DEFAULT 'preview_only',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'preview_created',
    "autonomyLevel" TEXT,
    "overallRiskLevel" TEXT,
    "readinessStatus" TEXT,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "safetyFlags" JSONB,
    "previewPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTaskSnapshot" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "snapshotKind" TEXT NOT NULL,
    "lifecycleStatus" TEXT,
    "taskSummary" TEXT,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB,
    "safetyNotes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTaskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTaskEvent" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relatedStepIds" JSONB,
    "relatedStepIndexes" JSONB,
    "relatedToolNames" JSONB,
    "relatedSkillNames" JSONB,
    "safetyNotes" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentTaskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPermissionRequest" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "requestStatus" TEXT NOT NULL DEFAULT 'preview_only',
    "sourceRequestStatus" TEXT,
    "autonomyLevel" TEXT,
    "overallRiskLevel" TEXT,
    "allowedByCurrentAutonomy" BOOLEAN,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "permissionFlowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "permissionRequests" JSONB,
    "blockedRequests" JSONB,
    "informationalRequests" JSONB,
    "confirmationSummary" JSONB,
    "riskSummary" JSONB,
    "recommendedNextActions" JSONB,
    "safetyNotes" JSONB,
    "previewPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPermissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPermissionDecision" (
    "id" TEXT NOT NULL,
    "permissionRequestId" TEXT,
    "taskId" TEXT,
    "decisionStatus" TEXT NOT NULL DEFAULT 'no_decision_captured',
    "sourceRequestStatus" TEXT,
    "permissionFlowEnabled" BOOLEAN NOT NULL DEFAULT false,
    "decisionCaptured" BOOLEAN NOT NULL DEFAULT false,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "requiredBeforeExecution" BOOLEAN NOT NULL DEFAULT false,
    "approvableRequestIds" JSONB,
    "blockedRequestIds" JSONB,
    "informationalRequestIds" JSONB,
    "missingDecisionReasons" JSONB,
    "blockedReasons" JSONB,
    "decisionItems" JSONB,
    "decisionShapePreview" JSONB,
    "recommendedNextActions" JSONB,
    "safetyNotes" JSONB,
    "previewPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentPermissionDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeExecution" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "userId" TEXT,
    "executionStatus" TEXT NOT NULL DEFAULT 'preview_ready',
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'preview_only',
    "boundaryFlags" JSONB,
    "safetyFlags" JSONB,
    "transitionState" JSONB,
    "currentStepId" TEXT,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "toolExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "llmCallEnabled" BOOLEAN NOT NULL DEFAULT false,
    "permissionConfirmationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "backgroundJobEnabled" BOOLEAN NOT NULL DEFAULT false,
    "streamingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRuntimeExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeStep" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepKey" TEXT,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview_only',
    "riskLevel" TEXT,
    "summary" TEXT,
    "inputSummary" TEXT,
    "outputSummary" TEXT,
    "blockedReasons" JSONB,
    "metadata" JSONB,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRuntimeStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeToolCall" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT,
    "toolName" TEXT NOT NULL,
    "toolKind" TEXT,
    "status" TEXT NOT NULL DEFAULT 'preview_only',
    "requirementSummary" TEXT,
    "inputSummary" TEXT,
    "resultSummary" TEXT,
    "riskLevel" TEXT,
    "blockedReasons" JSONB,
    "sandboxRequired" BOOLEAN NOT NULL DEFAULT true,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "toolExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRuntimeToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeLlmCall" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "stepId" TEXT,
    "providerKind" TEXT,
    "modelLabel" TEXT,
    "requestSummary" TEXT,
    "responseSummary" TEXT,
    "estimatedInputTokens" INTEGER,
    "estimatedOutputTokens" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'preview_only',
    "blockedReasons" JSONB,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "llmCallEnabled" BOOLEAN NOT NULL DEFAULT false,
    "streamingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRuntimeLlmCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeEvent" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "eventKind" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "action" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRuntimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRuntimeAuditLog" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "actorKind" TEXT,
    "action" TEXT NOT NULL,
    "targetKind" TEXT,
    "riskLevel" TEXT,
    "riskSummary" TEXT,
    "boundaryFlags" JSONB,
    "safetyFlags" JSONB,
    "metadata" JSONB,
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "executable" BOOLEAN NOT NULL DEFAULT false,
    "realExecutionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "productionAuditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentRuntimeAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "sourceMessageId" TEXT,
    "memoryType" "MemoryType" NOT NULL,
    "content" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL DEFAULT '0.1.0',
    "riskLevel" "SkillRiskLevel" NOT NULL DEFAULT 'LOW',
    "requiredAutonomyLevel" "AutonomyLevel" NOT NULL DEFAULT 'CONFIRM_ALL',
    "status" "SkillStatus" NOT NULL DEFAULT 'DRAFT',
    "manifest" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillToolRequirement" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "toolDefinitionId" TEXT,
    "toolName" TEXT NOT NULL,
    "riskNote" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillToolRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "riskLevel" "ToolRiskLevel" NOT NULL,
    "requiresConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutonomySetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" "AutonomyLevel" NOT NULL DEFAULT 'ANSWER_ONLY',
    "allowToolUse" BOOLEAN NOT NULL DEFAULT false,
    "requireConfirmationAboveRisk" "ToolRiskLevel" NOT NULL DEFAULT 'WRITE_LOW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutonomySetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_authProvider_authProviderId_idx" ON "User"("authProvider", "authProviderId");

-- CreateIndex
CREATE UNIQUE INDEX "User_authProvider_authProviderId_key" ON "User"("authProvider", "authProviderId");

-- CreateIndex
CREATE INDEX "Book_ownerId_idx" ON "Book"("ownerId");

-- CreateIndex
CREATE INDEX "Book_sourceType_idx" ON "Book"("sourceType");

-- CreateIndex
CREATE INDEX "Book_title_idx" ON "Book"("title");

-- CreateIndex
CREATE INDEX "BookChapter_bookId_orderIndex_idx" ON "BookChapter"("bookId", "orderIndex");

-- CreateIndex
CREATE INDEX "BookChapter_parentId_idx" ON "BookChapter"("parentId");

-- CreateIndex
CREATE INDEX "ContentChunk_bookId_idx" ON "ContentChunk"("bookId");

-- CreateIndex
CREATE INDEX "ContentChunk_chapterId_idx" ON "ContentChunk"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentChunk_chapterId_orderIndex_key" ON "ContentChunk"("chapterId", "orderIndex");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_updatedAt_idx" ON "ReadingProgress"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ReadingProgress_bookId_idx" ON "ReadingProgress"("bookId");

-- CreateIndex
CREATE INDEX "ReadingProgress_chapterId_idx" ON "ReadingProgress"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_bookId_chapterId_key" ON "ReadingProgress"("userId", "bookId", "chapterId");

-- CreateIndex
CREATE INDEX "ChapterQaHistory_userId_createdAt_idx" ON "ChapterQaHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ChapterQaHistory_bookId_idx" ON "ChapterQaHistory"("bookId");

-- CreateIndex
CREATE INDEX "ChapterQaHistory_chapterId_idx" ON "ChapterQaHistory"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAbilityProfile_userId_key" ON "UserAbilityProfile"("userId");

-- CreateIndex
CREATE INDEX "Problem_difficulty_idx" ON "Problem"("difficulty");

-- CreateIndex
CREATE INDEX "Problem_source_idx" ON "Problem"("source");

-- CreateIndex
CREATE INDEX "ProblemAttempt_userId_attemptedAt_idx" ON "ProblemAttempt"("userId", "attemptedAt");

-- CreateIndex
CREATE INDEX "ProblemAttempt_problemId_idx" ON "ProblemAttempt"("problemId");

-- CreateIndex
CREATE INDEX "ProblemAttempt_externalProblemId_idx" ON "ProblemAttempt"("externalProblemId");

-- CreateIndex
CREATE INDEX "ProblemAttempt_source_idx" ON "ProblemAttempt"("source");

-- CreateIndex
CREATE INDEX "ProblemAttempt_status_idx" ON "ProblemAttempt"("status");

-- CreateIndex
CREATE INDEX "DailyRecommendation_userId_recommendationDate_idx" ON "DailyRecommendation"("userId", "recommendationDate");

-- CreateIndex
CREATE INDEX "DailyRecommendation_problemId_idx" ON "DailyRecommendation"("problemId");

-- CreateIndex
CREATE INDEX "DailyRecommendation_status_idx" ON "DailyRecommendation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecommendation_userId_problemId_recommendationDate_key" ON "DailyRecommendation"("userId", "problemId", "recommendationDate");

-- CreateIndex
CREATE INDEX "AgentSession_userId_updatedAt_idx" ON "AgentSession"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AgentSession_contextType_idx" ON "AgentSession"("contextType");

-- CreateIndex
CREATE INDEX "AgentSession_bookId_idx" ON "AgentSession"("bookId");

-- CreateIndex
CREATE INDEX "AgentSession_chapterId_idx" ON "AgentSession"("chapterId");

-- CreateIndex
CREATE INDEX "AgentMessage_sessionId_createdAt_idx" ON "AgentMessage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentMessage_role_idx" ON "AgentMessage"("role");

-- CreateIndex
CREATE UNIQUE INDEX "AgentMessage_sessionId_orderIndex_key" ON "AgentMessage"("sessionId", "orderIndex");

-- CreateIndex
CREATE INDEX "AgentTask_userId_idx" ON "AgentTask"("userId");

-- CreateIndex
CREATE INDEX "AgentTask_lifecycleStatus_idx" ON "AgentTask"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "AgentTask_readinessStatus_idx" ON "AgentTask"("readinessStatus");

-- CreateIndex
CREATE INDEX "AgentTask_createdAt_idx" ON "AgentTask"("createdAt");

-- CreateIndex
CREATE INDEX "AgentTaskSnapshot_taskId_idx" ON "AgentTaskSnapshot"("taskId");

-- CreateIndex
CREATE INDEX "AgentTaskSnapshot_snapshotKind_idx" ON "AgentTaskSnapshot"("snapshotKind");

-- CreateIndex
CREATE INDEX "AgentTaskSnapshot_createdAt_idx" ON "AgentTaskSnapshot"("createdAt");

-- CreateIndex
CREATE INDEX "AgentTaskEvent_taskId_idx" ON "AgentTaskEvent"("taskId");

-- CreateIndex
CREATE INDEX "AgentTaskEvent_eventType_idx" ON "AgentTaskEvent"("eventType");

-- CreateIndex
CREATE INDEX "AgentTaskEvent_severity_idx" ON "AgentTaskEvent"("severity");

-- CreateIndex
CREATE INDEX "AgentTaskEvent_createdAt_idx" ON "AgentTaskEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AgentPermissionRequest_taskId_idx" ON "AgentPermissionRequest"("taskId");

-- CreateIndex
CREATE INDEX "AgentPermissionRequest_requestStatus_idx" ON "AgentPermissionRequest"("requestStatus");

-- CreateIndex
CREATE INDEX "AgentPermissionRequest_overallRiskLevel_idx" ON "AgentPermissionRequest"("overallRiskLevel");

-- CreateIndex
CREATE INDEX "AgentPermissionRequest_requiresConfirmation_idx" ON "AgentPermissionRequest"("requiresConfirmation");

-- CreateIndex
CREATE INDEX "AgentPermissionRequest_createdAt_idx" ON "AgentPermissionRequest"("createdAt");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_permissionRequestId_idx" ON "AgentPermissionDecision"("permissionRequestId");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_taskId_idx" ON "AgentPermissionDecision"("taskId");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_decisionStatus_idx" ON "AgentPermissionDecision"("decisionStatus");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_decisionCaptured_idx" ON "AgentPermissionDecision"("decisionCaptured");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_requiredBeforeExecution_idx" ON "AgentPermissionDecision"("requiredBeforeExecution");

-- CreateIndex
CREATE INDEX "AgentPermissionDecision_createdAt_idx" ON "AgentPermissionDecision"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRuntimeExecution_taskId_idx" ON "AgentRuntimeExecution"("taskId");

-- CreateIndex
CREATE INDEX "AgentRuntimeExecution_userId_idx" ON "AgentRuntimeExecution"("userId");

-- CreateIndex
CREATE INDEX "AgentRuntimeExecution_executionStatus_idx" ON "AgentRuntimeExecution"("executionStatus");

-- CreateIndex
CREATE INDEX "AgentRuntimeExecution_createdAt_idx" ON "AgentRuntimeExecution"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRuntimeStep_executionId_idx" ON "AgentRuntimeStep"("executionId");

-- CreateIndex
CREATE INDEX "AgentRuntimeStep_status_idx" ON "AgentRuntimeStep"("status");

-- CreateIndex
CREATE INDEX "AgentRuntimeToolCall_executionId_idx" ON "AgentRuntimeToolCall"("executionId");

-- CreateIndex
CREATE INDEX "AgentRuntimeToolCall_toolName_idx" ON "AgentRuntimeToolCall"("toolName");

-- CreateIndex
CREATE INDEX "AgentRuntimeToolCall_status_idx" ON "AgentRuntimeToolCall"("status");

-- CreateIndex
CREATE INDEX "AgentRuntimeLlmCall_executionId_idx" ON "AgentRuntimeLlmCall"("executionId");

-- CreateIndex
CREATE INDEX "AgentRuntimeLlmCall_providerKind_idx" ON "AgentRuntimeLlmCall"("providerKind");

-- CreateIndex
CREATE INDEX "AgentRuntimeLlmCall_status_idx" ON "AgentRuntimeLlmCall"("status");

-- CreateIndex
CREATE INDEX "AgentRuntimeEvent_executionId_idx" ON "AgentRuntimeEvent"("executionId");

-- CreateIndex
CREATE INDEX "AgentRuntimeEvent_eventKind_idx" ON "AgentRuntimeEvent"("eventKind");

-- CreateIndex
CREATE INDEX "AgentRuntimeEvent_createdAt_idx" ON "AgentRuntimeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRuntimeAuditLog_executionId_idx" ON "AgentRuntimeAuditLog"("executionId");

-- CreateIndex
CREATE INDEX "AgentRuntimeAuditLog_action_idx" ON "AgentRuntimeAuditLog"("action");

-- CreateIndex
CREATE INDEX "AgentRuntimeAuditLog_createdAt_idx" ON "AgentRuntimeAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "MemoryItem_userId_memoryType_idx" ON "MemoryItem"("userId", "memoryType");

-- CreateIndex
CREATE INDEX "MemoryItem_sessionId_idx" ON "MemoryItem"("sessionId");

-- CreateIndex
CREATE INDEX "MemoryItem_importance_idx" ON "MemoryItem"("importance");

-- CreateIndex
CREATE INDEX "Skill_ownerUserId_idx" ON "Skill"("ownerUserId");

-- CreateIndex
CREATE INDEX "Skill_status_idx" ON "Skill"("status");

-- CreateIndex
CREATE INDEX "Skill_riskLevel_idx" ON "Skill"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_ownerUserId_name_version_key" ON "Skill"("ownerUserId", "name", "version");

-- CreateIndex
CREATE INDEX "SkillToolRequirement_toolName_idx" ON "SkillToolRequirement"("toolName");

-- CreateIndex
CREATE INDEX "SkillToolRequirement_toolDefinitionId_idx" ON "SkillToolRequirement"("toolDefinitionId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillToolRequirement_skillId_toolName_key" ON "SkillToolRequirement"("skillId", "toolName");

-- CreateIndex
CREATE UNIQUE INDEX "ToolDefinition_name_key" ON "ToolDefinition"("name");

-- CreateIndex
CREATE INDEX "ToolDefinition_riskLevel_idx" ON "ToolDefinition"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "AutonomySetting_userId_key" ON "AutonomySetting"("userId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookChapter" ADD CONSTRAINT "BookChapter_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookChapter" ADD CONSTRAINT "BookChapter_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BookChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentChunk" ADD CONSTRAINT "ContentChunk_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentChunk" ADD CONSTRAINT "ContentChunk_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingProgress" ADD CONSTRAINT "ReadingProgress_lastChunkId_fkey" FOREIGN KEY ("lastChunkId") REFERENCES "ContentChunk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterQaHistory" ADD CONSTRAINT "ChapterQaHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterQaHistory" ADD CONSTRAINT "ChapterQaHistory_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterQaHistory" ADD CONSTRAINT "ChapterQaHistory_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAbilityProfile" ADD CONSTRAINT "UserAbilityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAttempt" ADD CONSTRAINT "ProblemAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemAttempt" ADD CONSTRAINT "ProblemAttempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecommendation" ADD CONSTRAINT "DailyRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyRecommendation" ADD CONSTRAINT "DailyRecommendation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSession" ADD CONSTRAINT "AgentSession_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "BookChapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMessage" ADD CONSTRAINT "AgentMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTaskSnapshot" ADD CONSTRAINT "AgentTaskSnapshot_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTaskEvent" ADD CONSTRAINT "AgentTaskEvent_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPermissionDecision" ADD CONSTRAINT "AgentPermissionDecision_permissionRequestId_fkey" FOREIGN KEY ("permissionRequestId") REFERENCES "AgentPermissionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeExecution" ADD CONSTRAINT "AgentRuntimeExecution_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeStep" ADD CONSTRAINT "AgentRuntimeStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentRuntimeExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeToolCall" ADD CONSTRAINT "AgentRuntimeToolCall_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentRuntimeExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeLlmCall" ADD CONSTRAINT "AgentRuntimeLlmCall_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentRuntimeExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeEvent" ADD CONSTRAINT "AgentRuntimeEvent_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentRuntimeExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRuntimeAuditLog" ADD CONSTRAINT "AgentRuntimeAuditLog_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "AgentRuntimeExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AgentSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryItem" ADD CONSTRAINT "MemoryItem_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "AgentMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillToolRequirement" ADD CONSTRAINT "SkillToolRequirement_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillToolRequirement" ADD CONSTRAINT "SkillToolRequirement_toolDefinitionId_fkey" FOREIGN KEY ("toolDefinitionId") REFERENCES "ToolDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutonomySetting" ADD CONSTRAINT "AutonomySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
