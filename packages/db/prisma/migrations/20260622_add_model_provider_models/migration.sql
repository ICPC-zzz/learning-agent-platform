-- CreateEnum
CREATE TYPE "ModelProviderType" AS ENUM ('OPENAI_COMPATIBLE', 'SERVER_MANAGED');

-- CreateEnum
CREATE TYPE "ModelAuthMode" AS ENUM ('BEARER', 'API_KEY_HEADER', 'BASIC_AUTH', 'CUSTOM_HEADERS', 'NONE');

-- CreateEnum
CREATE TYPE "ModelConnectionStatus" AS ENUM ('UNTESTED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "ModelUsageType" AS ENUM ('CHAT', 'PLANNING', 'CODE_ANALYSIS', 'SUMMARIZATION', 'MEMORY_EXTRACTION', 'EMBEDDING', 'FALLBACK');

-- CreateTable
CREATE TABLE "ModelProvider" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "ModelProviderType" NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
    "baseUrl" TEXT NOT NULL,
    "authMode" "ModelAuthMode" NOT NULL DEFAULT 'BEARER',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "requestTimeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "maxRetries" INTEGER NOT NULL DEFAULT 1,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" "ModelConnectionStatus",
    "lastTestLatencyMs" INTEGER,
    "lastTestErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserModelCredential" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "encryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "encryptedPayload" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT,
    "maskedHintsJson" TEXT NOT NULL DEFAULT '{}',
    "credentialDefJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserModelCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelProfile" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "contextWindow" INTEGER NOT NULL DEFAULT 4096,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 2048,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT false,
    "supportsJsonSchema" BOOLEAN NOT NULL DEFAULT false,
    "supportsFiles" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "usageType" "ModelUsageType" NOT NULL DEFAULT 'CHAT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModelProvider_ownerId_name_key" ON "ModelProvider"("ownerId", "name");

-- CreateIndex
CREATE INDEX "ModelProvider_ownerId_idx" ON "ModelProvider"("ownerId");

-- CreateIndex
CREATE INDEX "ModelProvider_providerType_idx" ON "ModelProvider"("providerType");

-- CreateIndex
CREATE UNIQUE INDEX "UserModelCredential_providerId_key" ON "UserModelCredential"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelProfile_providerId_modelId_usageType_key" ON "ModelProfile"("providerId", "modelId", "usageType");

-- CreateIndex
CREATE INDEX "ModelProfile_providerId_idx" ON "ModelProfile"("providerId");

-- CreateIndex
CREATE INDEX "ModelProfile_usageType_idx" ON "ModelProfile"("usageType");

-- AddForeignKey
ALTER TABLE "ModelProvider" ADD CONSTRAINT "ModelProvider_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserModelCredential" ADD CONSTRAINT "UserModelCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ModelProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelProfile" ADD CONSTRAINT "ModelProfile_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "ModelProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
