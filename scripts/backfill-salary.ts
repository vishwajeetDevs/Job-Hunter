/**
 * One-time backfill: scan every job that has no salary columns but has a
 * description, run the salary extractor, and persist any found values.
 *
 * Run with:
 *   npx tsx scripts/backfill-salary.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { extractSalaryFromDescription } from "../src/services/jobs/enrichment/salary-extractor";

const BATCH = 500;

async function main() {
  let offset = 0;
  let totalUpdated = 0;

  for (;;) {
    const rows = await prisma.job.findMany({
      where: {
        salaryMin: null,
        salaryMax: null,
        description: { not: null },
      },
      select: { id: true, description: true },
      skip: offset,
      take: BATCH,
      orderBy: { createdAt: "asc" },
    });

    if (rows.length === 0) break;

    const updates = rows.flatMap((row) => {
      const extracted = extractSalaryFromDescription(row.description);
      if (!extracted) return [];
      return [
        prisma.job.update({
          where: { id: row.id },
          data: {
            salaryMin: extracted.min,
            salaryMax: extracted.max,
            salaryCurrency: extracted.currency,
          },
        }),
      ];
    });

    if (updates.length > 0) {
      await Promise.all(updates);
      totalUpdated += updates.length;
      console.log(
        `Batch offset=${offset}: scanned ${rows.length}, updated ${updates.length} rows`
      );
    } else {
      console.log(`Batch offset=${offset}: scanned ${rows.length}, 0 matches`);
    }

    offset += rows.length;
    if (rows.length < BATCH) break;
  }

  console.log(`\nDone. Total rows updated: ${totalUpdated}`);
  await prisma.$disconnect();
  process.exit(0);
}

void main();
