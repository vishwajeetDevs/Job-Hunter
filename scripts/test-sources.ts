/**
 * Manual health check for all job source adapters, using the same
 * TRACKED_COMPANIES targets a real refresh uses. Fetch-only (no DB writes).
 * Run: npx tsx scripts/test-sources.ts
 */
import "dotenv/config";

import { getJobSourceAdapter } from "../src/services/jobs/aggregation";
import { TRACKED_COMPANIES } from "../src/services/jobs/tracked-companies";

async function main() {
  const totals = new Map<string, number>();
  const failures: string[] = [];

  for (const target of TRACKED_COMPANIES) {
    const adapter = getJobSourceAdapter(target.source);
    const label = `${target.source}:${target.companyToken}`;

    if (adapter.isConfigured && !adapter.isConfigured()) {
      console.log(`SKIP  ${label} (not configured)`);
      continue;
    }

    try {
      const jobs = await adapter.fetchJobs(target);
      totals.set(target.source, (totals.get(target.source) ?? 0) + jobs.length);
      console.log(`OK    ${label} -> ${jobs.length} jobs`);
    } catch (error) {
      failures.push(label);
      console.log(
        `FAIL  ${label} -> ${error instanceof Error ? error.message : error}`
      );
    }
  }

  console.log("\n=== Totals by source ===");
  for (const [source, count] of totals) {
    console.log(`${source}: ${count}`);
  }
  if (failures.length > 0) {
    console.log(`\nFailed targets: ${failures.join(", ")}`);
  }
}

void main();
