import { cache } from "react";

import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

type DbUser = NonNullable<Awaited<ReturnType<typeof prisma.user.findUnique>>>;

/**
 * Short-lived cross-request cache. The user row only changes when the
 * Clerk profile changes, so re-reading it (and re-syncing the profile)
 * on every navigation just adds a DB round trip per page. Entries
 * expire so profile edits still propagate within a few minutes.
 */
const userCache = new Map<string, { user: DbUser; expiresAt: number }>();
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(clerkUserId: string): DbUser | null {
  const entry = userCache.get(clerkUserId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    userCache.delete(clerkUserId);
    return null;
  }
  return entry.user;
}

function setCached(clerkUserId: string, user: DbUser): void {
  userCache.set(clerkUserId, {
    user,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });
}

async function syncUserFromClerk(clerkUserId: string): Promise<DbUser> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Authenticated Clerk user not found.");
  }

  const email =
    clerkUser.primaryEmailAddress?.emailAddress ??
    clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error("User email is required.");
  }

  const name = [clerkUser.firstName, clerkUser.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return prisma.user.upsert({
    where: { clerkUserId },
    create: {
      clerkUserId,
      email,
      name: name || null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
    update: {
      email,
      name: name || null,
      imageUrl: clerkUser.imageUrl ?? null,
    },
  });
}

/**
 * Ensures the authenticated Clerk user exists in our database.
 * Called before any user-scoped database operation.
 *
 * Fast path: a single indexed read (cached for a few minutes), so page
 * navigations don't pay for a Clerk API call + DB write every time.
 * The full Clerk profile sync only runs when the user is first seen.
 */
export const ensureDbUser = cache(async (clerkUserId: string) => {
  const cached = getCached(clerkUserId);
  if (cached) return cached;

  const existing = await prisma.user.findUnique({ where: { clerkUserId } });
  if (existing) {
    setCached(clerkUserId, existing);
    return existing;
  }

  const created = await syncUserFromClerk(clerkUserId);
  setCached(clerkUserId, created);
  return created;
});

export async function getDbUserByClerkId(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkUserId },
  });
}
