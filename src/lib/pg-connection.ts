/**
 * Normalizes a PostgreSQL connection string for the `pg` driver.
 *
 * Neon (and many hosted Postgres providers) ship URLs with
 * `sslmode=require`. In pg v8 that is treated as verify-full, but Node
 * prints a deprecation warning on every new connection. Setting
 * `sslmode=verify-full` explicitly keeps the same TLS behavior and
 * silences the warning ahead of pg v9's libpq-compatible semantics.
 */
export function normalizePgConnectionString(
  connectionString: string | undefined
): string | undefined {
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    const sslmode = url.searchParams.get("sslmode");

    if (!sslmode || sslmode === "require" || sslmode === "prefer" || sslmode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    return connectionString;
  }
}
