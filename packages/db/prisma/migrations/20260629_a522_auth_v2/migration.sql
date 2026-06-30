-- A522 Auth v2: production web sessions, DB RBAC, and auth audit events.
-- Non-destructive migration: adds enum, columns, and tables only.

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "disabledAt" TIMESTAMP(3);

CREATE TABLE "WebSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "userAgentHash" TEXT,
  "ipHash" TEXT,

  CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthAuditEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "eventType" TEXT NOT NULL,
  "sourceSummary" TEXT,
  "result" TEXT NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebSession_tokenHash_key" ON "WebSession"("tokenHash");
CREATE INDEX "WebSession_userId_idx" ON "WebSession"("userId");
CREATE INDEX "WebSession_expiresAt_idx" ON "WebSession"("expiresAt");
CREATE INDEX "WebSession_revokedAt_idx" ON "WebSession"("revokedAt");

CREATE INDEX "AuthAuditEvent_userId_createdAt_idx" ON "AuthAuditEvent"("userId", "createdAt");
CREATE INDEX "AuthAuditEvent_eventType_createdAt_idx" ON "AuthAuditEvent"("eventType", "createdAt");
CREATE INDEX "AuthAuditEvent_result_idx" ON "AuthAuditEvent"("result");

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_disabledAt_idx" ON "User"("disabledAt");

ALTER TABLE "WebSession"
  ADD CONSTRAINT "WebSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthAuditEvent"
  ADD CONSTRAINT "AuthAuditEvent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
