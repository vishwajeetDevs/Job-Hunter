import { currentUser } from "@clerk/nextjs/server";

import { prisma } from "@/lib/prisma";

/**
 * Ensures the authenticated Clerk user exists in our database.
 * Called before any user-scoped database operation.
 */
export async function ensureDbUser(clerkUserId: string) {
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

export async function getDbUserByClerkId(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkUserId },
  });
}
