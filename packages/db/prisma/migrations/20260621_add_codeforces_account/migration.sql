-- A485: Codeforces account binding and user data sync models
-- Non-destructive migration — adds tables and indexes only, no drops or destructive changes.

-- CodeforcesAccount: one per user, stores binding state and profile snapshot
CREATE TABLE IF NOT EXISTS "CodeforcesAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canonicalHandle" TEXT NOT NULL,
    "normalizedHandle" TEXT NOT NULL,
    "currentRating" INTEGER,
    "maxRating" INTEGER,
    "rank" TEXT,
    "maxRank" TEXT,
    "contribution" INTEGER,
    "friendOfCount" INTEGER,
    "lastOnlineAt" TIMESTAMP(3),
    "registrationAt" TIMESTAMP(3),
    "lastSubmissionAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncedSubmissionId" INTEGER,
    "syncStatus" TEXT NOT NULL DEFAULT 'idle',
    "syncErrorCode" TEXT,
    "dataTruncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeforcesAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeforcesAccount_userId_key" ON "CodeforcesAccount"("userId");
CREATE INDEX IF NOT EXISTS "CodeforcesAccount_normalizedHandle_idx" ON "CodeforcesAccount"("normalizedHandle");
CREATE INDEX IF NOT EXISTS "CodeforcesAccount_syncStatus_idx" ON "CodeforcesAccount"("syncStatus");

ALTER TABLE "CodeforcesAccount" ADD CONSTRAINT "CodeforcesAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodeforcesUserProblemStat: per-user, per-problem aggregated stats
CREATE TABLE IF NOT EXISTS "CodeforcesUserProblemStat" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "problemKey" TEXT NOT NULL,
    "contestId" INTEGER NOT NULL,
    "index" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rating" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "firstSubmittedAt" TIMESTAMP(3),
    "firstAcceptedAt" TIMESTAMP(3),
    "lastSubmittedAt" TIMESTAMP(3),
    "lastVerdict" TEXT,
    "lastSubmissionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeforcesUserProblemStat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeforcesUserProblemStat_accountId_problemKey_key" ON "CodeforcesUserProblemStat"("accountId", "problemKey");
CREATE INDEX IF NOT EXISTS "CodeforcesUserProblemStat_accountId_accepted_idx" ON "CodeforcesUserProblemStat"("accountId", "accepted");
CREATE INDEX IF NOT EXISTS "CodeforcesUserProblemStat_accountId_rating_idx" ON "CodeforcesUserProblemStat"("accountId", "rating");
CREATE INDEX IF NOT EXISTS "CodeforcesUserProblemStat_problemKey_idx" ON "CodeforcesUserProblemStat"("problemKey");

ALTER TABLE "CodeforcesUserProblemStat" ADD CONSTRAINT "CodeforcesUserProblemStat_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CodeforcesAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodeforcesRatingChange: per-contest rating history
CREATE TABLE IF NOT EXISTS "CodeforcesRatingChange" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contestId" INTEGER NOT NULL,
    "contestName" TEXT NOT NULL,
    "rank" INTEGER,
    "oldRating" INTEGER NOT NULL,
    "newRating" INTEGER NOT NULL,
    "ratingUpdateAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeforcesRatingChange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeforcesRatingChange_accountId_contestId_key" ON "CodeforcesRatingChange"("accountId", "contestId");
CREATE INDEX IF NOT EXISTS "CodeforcesRatingChange_accountId_ratingUpdateAt_idx" ON "CodeforcesRatingChange"("accountId", "ratingUpdateAt");

ALTER TABLE "CodeforcesRatingChange" ADD CONSTRAINT "CodeforcesRatingChange_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CodeforcesAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CodeforcesRecentSubmission: lightweight recent submissions (NO source code)
CREATE TABLE IF NOT EXISTS "CodeforcesRecentSubmission" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "problemKey" TEXT NOT NULL,
    "contestId" INTEGER,
    "index" TEXT,
    "name" TEXT,
    "verdict" TEXT,
    "creationTimeSeconds" INTEGER NOT NULL,
    "language" TEXT,
    "passedTestCount" INTEGER,
    "timeConsumedMillis" INTEGER,
    "memoryConsumedBytes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeforcesRecentSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodeforcesRecentSubmission_accountId_submissionId_key" ON "CodeforcesRecentSubmission"("accountId", "submissionId");
CREATE INDEX IF NOT EXISTS "CodeforcesRecentSubmission_accountId_creationTimeSeconds_idx" ON "CodeforcesRecentSubmission"("accountId", "creationTimeSeconds" DESC);
CREATE INDEX IF NOT EXISTS "CodeforcesRecentSubmission_problemKey_idx" ON "CodeforcesRecentSubmission"("problemKey");

ALTER TABLE "CodeforcesRecentSubmission" ADD CONSTRAINT "CodeforcesRecentSubmission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CodeforcesAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
