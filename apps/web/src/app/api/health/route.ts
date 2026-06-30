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
        status: "unavailable",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }

  try {
    await getPrismaClient().$queryRawUnsafe("SELECT 1");
    return NextResponse.json({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
