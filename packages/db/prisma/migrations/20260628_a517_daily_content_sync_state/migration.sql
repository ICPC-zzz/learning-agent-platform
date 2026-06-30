-- A517: Persist daily content sync status and coarse DB lock state.
-- Non-destructive: adds a new table and indexes only.

CREATE TABLE IF NOT EXISTS "DailyContentSyncState" (
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "safeSummary" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyContentSyncState_pkey" PRIMARY KEY ("name")
);

CREATE INDEX IF NOT EXISTS "DailyContentSyncState_status_leaseExpiresAt_idx" ON "DailyContentSyncState"("status", "leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "DailyContentSyncState_lastSuccessAt_idx" ON "DailyContentSyncState"("lastSuccessAt");
