import { cache } from "react";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AUTH_ROUTES } from "@/lib/auth/constants";

// React cache: the layout (AuthGuard) and every page both call this,
// so dedupe the Clerk session lookup within a single request.
const getAuthUserId = cache(async () => {
  const { userId } = await auth();
  return userId;
});

export async function requireAuth(redirectTo: string = AUTH_ROUTES.signIn) {
  const userId = await getAuthUserId();

  if (!userId) {
    redirect(redirectTo);
  }

  return { userId };
}
