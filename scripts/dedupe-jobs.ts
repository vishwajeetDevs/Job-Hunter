import "dotenv/config";

import { stableExternalId } from "../src/services/jobs/aggregation/adapter.interface";
import { prisma } from "../src/lib/prisma";

const SOURCES = ["careerjet", "jooble", "adzuna"] as const;

function normKey(source: string, title: string, company: string, location: string | null) {
  return stableExternalId([source, title, company, location]);
}

async function main() {
  const rows = await prisma.job.findMany({
    where: { source: { in: [...SOURCES] } },
    select: {
      id: true,
      source: true,
      title: true,
      company: true,
      location: true,
      description: true,
      createdAt: true,
      externalId: true,
      _count: { select: { applications: true, resumes: true } },
    },
  });

  // Group by content identity.
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normKey(row.source!, row.title, row.company, row.location);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  // 1. Delete duplicates, keeping the best row per group.
  let deleted = 0;
  for (const list of groups.values()) {
    if (list.length < 2) continue;

    const sorted = [...list].sort((a, b) => {
      const aRef = a._count.applications + a._count.resumes;
      const bRef = b._count.applications + b._count.resumes;
      if (aRef !== bRef) return bRef - aRef; // referenced rows first
      const aDesc = a.description?.length ?? 0;
      const bDesc = b.description?.length ?? 0;
      if (aDesc !== bDesc) return bDesc - aDesc; // richer description
      return a.createdAt.getTime() - b.createdAt.getTime(); // oldest
    });

    const [, ...rest] = sorted;
    const deletable = rest.filter(
      (row) => row._count.applications + row._count.resumes === 0
    );
    if (deletable.length > 0) {
      const result = await prisma.job.deleteMany({
        where: { id: { in: deletable.map((row) => row.id) } },
      });
      deleted += result.count;
    }
  }

  console.log("duplicate rows deleted:", deleted);

  // 2. Re-key every surviving row of these sources to the stable hash so
  //    future fetches (which now emit hashes) hit the unique constraint.
  const survivors = await prisma.job.findMany({
    where: { source: { in: [...SOURCES] } },
    select: { id: true, source: true, title: true, company: true, location: true, externalId: true },
  });

  let rekeyed = 0;
  let conflicts = 0;
  for (const row of survivors) {
    const hash = normKey(row.source!, row.title, row.company, row.location);
    if (row.externalId === hash) continue;
    try {
      await prisma.job.update({ where: { id: row.id }, data: { externalId: hash } });
      rekeyed += 1;
    } catch {
      // Unique conflict — a referenced duplicate kept the same identity.
      conflicts += 1;
    }
  }
  console.log("rows re-keyed to stable hash:", rekeyed, "| conflicts skipped:", conflicts);

  // 3. Verify: no content-duplicate groups left for these sources.
  const remaining = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) AS n FROM (
      SELECT 1 FROM jobs
      WHERE source IN ('careerjet', 'jooble', 'adzuna')
      GROUP BY source, LOWER(title), LOWER(company), COALESCE(LOWER(location), '')
      HAVING COUNT(*) > 1
    ) d`;
  console.log("remaining duplicate groups:", Number(remaining[0].n));

  await prisma.$disconnect();
  process.exit(0);
}

void main();
