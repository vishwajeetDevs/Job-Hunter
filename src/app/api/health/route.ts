import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Always hit the database — never serve a cached response.
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Verifies the Neon PostgreSQL connection by running a trivial query
 * through the Prisma client (pooled connection).
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health] Database check failed:", error);

    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
