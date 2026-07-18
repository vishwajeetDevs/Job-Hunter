import {
  clerkMiddleware,
  createRouteMatcher,
} from "@clerk/nextjs/server";

import { PROTECTED_ROUTES } from "@/lib/auth/constants";

const isProtectedRoute = createRouteMatcher([...PROTECTED_ROUTES]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    // Redirects to NEXT_PUBLIC_CLERK_SIGN_IN_URL when signed out
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
