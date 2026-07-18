import "dotenv/config";
import { defineConfig } from "prisma/config";

import { normalizePgConnectionString } from "./src/lib/pg-connection";

/**
 * Prisma CLI configuration.
 *
 * Migrations and introspection use DIRECT_URL (Neon's direct, non-pooled
 * connection) because the migration engine requires session-level features
 * that PgBouncer does not support. Runtime queries use the pooled
 * DATABASE_URL via the pg driver adapter in `src/lib/prisma.ts`.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: normalizePgConnectionString(
      process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"]
    ),
  },
});
