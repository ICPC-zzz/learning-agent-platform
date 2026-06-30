-- A503: Restore current business models that are still referenced by
-- Articles, email auth, and daily content loaders.
-- Non-destructive: adds missing tables/column/indexes only.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "EmailOtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailOtpCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmailOtpCode_email_purpose_expiresAt_idx" ON "EmailOtpCode"("email", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "EmailOtpCode_expiresAt_idx" ON "EmailOtpCode"("expiresAt");
CREATE INDEX IF NOT EXISTS "EmailOtpCode_consumedAt_idx" ON "EmailOtpCode"("consumedAt");

CREATE TABLE IF NOT EXISTS "ArticleFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleFavorite_userId_articleId_key" ON "ArticleFavorite"("userId", "articleId");
CREATE INDEX IF NOT EXISTS "ArticleFavorite_userId_updatedAt_idx" ON "ArticleFavorite"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ArticleFavorite_articleId_idx" ON "ArticleFavorite"("articleId");

CREATE TABLE IF NOT EXISTS "ArticleReading" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "articleTitle" TEXT NOT NULL,
    "sourcePlatform" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleReading_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ArticleReading_userId_articleId_key" ON "ArticleReading"("userId", "articleId");
CREATE INDEX IF NOT EXISTS "ArticleReading_userId_lastReadAt_idx" ON "ArticleReading"("userId", "lastReadAt");
CREATE INDEX IF NOT EXISTS "ArticleReading_articleId_idx" ON "ArticleReading"("articleId");

CREATE TABLE IF NOT EXISTS "DailyContentItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "originalUrl" TEXT,
    "discussionUrl" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "dailyDate" TIMESTAMP(3) NOT NULL,
    "score" INTEGER,
    "commentCount" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyContentItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyContentItem_kind_source_externalId_dailyDate_key" ON "DailyContentItem"("kind", "source", "externalId", "dailyDate");
CREATE INDEX IF NOT EXISTS "DailyContentItem_kind_dailyDate_idx" ON "DailyContentItem"("kind", "dailyDate");
CREATE INDEX IF NOT EXISTS "DailyContentItem_source_idx" ON "DailyContentItem"("source");
