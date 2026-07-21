import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import { normalizePgConnectionString } from "@/lib/pg-connection";

/**
 * Prisma singleton.
 *
 * Runtime queries go through Neon's POOLED connection string (DATABASE_URL)
 * using the pg driver adapter. In development, the client is cached on
 * `globalThis` so hot reloads don't exhaust the connection pool by creating
 * a new client on every module reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = normalizePgConnectionString(process.env.DATABASE_URL);

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env and restart the dev server."
    );
  }

  const pool = new pg.Pool({
    connectionString,
    // Keep the app-side pool small — Neon's PgBouncer handles fan-out.
    max: 10,
    // Neon is a remote region away; opening a connection costs a full
    // TCP + TLS handshake (hundreds of ms). Keep connections alive and
    // hold idle ones much longer than the 10s default so navigations
    // reuse warm connections instead of reconnecting every time.
    keepAlive: true,
    idleTimeoutMillis: 10 * 60 * 1000,
  });

  const adapter = new PrismaPg(pool);

  // In development, ping periodically so the pool keeps a warm
  // connection and Neon's autosuspend doesn't cold-start the database
  // between navigations (which adds seconds to the next query).
  if (process.env.NODE_ENV === "development") {
    const globalForKeepAlive = globalThis as unknown as {
      prismaKeepAlive: NodeJS.Timeout | undefined;
    };
    if (!globalForKeepAlive.prismaKeepAlive) {
      globalForKeepAlive.prismaKeepAlive = setInterval(() => {
        pool.query("SELECT 1").catch(() => {
          // Ignore — next real query will reconnect.
        });
      }, 4 * 60 * 1000);
      globalForKeepAlive.prismaKeepAlive.unref();
    }
  }

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
