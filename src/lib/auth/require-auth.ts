import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AUTH_ROUTES } from "@/lib/auth/constants";

export async function requireAuth(redirectTo: string = AUTH_ROUTES.signIn) {
  const { userId } = await auth();

  if (!userId) {
    redirect(redirectTo);
  }

  return { userId };
}
