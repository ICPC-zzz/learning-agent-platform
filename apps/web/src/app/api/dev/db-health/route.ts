/**
 * Minimal DB health-check endpoint for local development preview.
 *
 * Performs a lightweight `SELECT 1` against the configured database
 * and returns a connection status.  This route is intentionally minimal:
 * it does NOT execute writes, read real user data, or expose connection
 * details (DATABASE_URL, stack traces, or internal error messages).
 *
 * ## Access (when the dev server is running)
 *
 *   http://localhost:3000/api/dev/db-health
 *
 * ## Response shapes
 *
 * Connected:
 *   { "ok": true,  "status": "connected",   "mode": "development-preview" }
 *
 * Unavailable:
 *   { "ok": false, "status": "unavailable", "mode": "development-preview" }
 *
 * This endpoint is a **development-preview** tool; it is not intended
 * for production monitoring or automated alerting.
 */

import { NextResponse } from "next/server";
import {
  getDatabaseEnvStatus,
  getPrismaClient,
} from "@learning-agent-platform/db";

export async function GET(): Promise<NextResponse> {
  const envStatus = getDatabaseEnvStatus();

  if (!envStatus.hasDatabaseUrl) {
    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        mode: "development-preview",
      },
      { status: 503 },
    );
  }

  try {
    const prisma = getPrismaClient();

    // Lightweight connectivity probe — no writes, no user data reads.
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json({
      ok: true,
      status: "connected",
      mode: "development-preview",
    });
  } catch (error: unknown) {
    // Log a brief diagnostic to the server console only.
    // Never include DATABASE_URL, stack traces, or raw error details
    // in the client response.
    const brief =
      error instanceof Error ? error.constructor.name : "UnknownError";
    console.error("db-health check failed:", brief);

    return NextResponse.json(
      {
        ok: false,
        status: "unavailable",
        mode: "development-preview",
      },
      { status: 503 },
    );
  }
}
