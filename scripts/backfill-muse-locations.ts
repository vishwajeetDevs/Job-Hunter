/**
 * One-off backfill: reformats existing The Muse job locations stored as
 * "City, India; City, India; Flexible / Remote" into the compact format
 * produced by formatLocationList ("City, City, India · Remote").
 * Run: npx tsx scripts/backfill-muse-locations.ts
 */
import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { formatLocationList } from "../src/services/jobs/aggregation/types";

async function main() {
  const jobs = await prisma.job.findMany({
    where: { source: "themuse", location: { contains: ";" } },
    select: { id: true, location: true },
  });

  console.log(`Found ${jobs.length} Muse jobs with multi-part locations.`);

  let updated = 0;

  for (const job of jobs) {
    const formatted = formatLocationList(job.location!.split(";"));
    if (!formatted || formatted === job.location) continue;

    await prisma.job.update({
      where: { id: job.id },
      data: { location: formatted },
    });
    console.log(`${job.location}  ->  ${formatted}`);
    updated += 1;
  }

  console.log(`Updated ${updated} jobs.`);
  await prisma.$disconnect();
}

void main();
