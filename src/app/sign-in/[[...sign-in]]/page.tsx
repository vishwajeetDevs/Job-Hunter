import { SignIn } from "@clerk/nextjs";

import { AUTH_ROUTES } from "@/lib/auth/constants";
import { SITE_NAME } from "@/lib/constants";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Welcome back
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Sign in to {SITE_NAME}
        </h1>
      </div>

      <SignIn
        routing="path"
        path={AUTH_ROUTES.signIn}
        signUpUrl={AUTH_ROUTES.signUp}
        forceRedirectUrl={AUTH_ROUTES.dashboard}
        fallbackRedirectUrl={AUTH_ROUTES.dashboard}
      />
    </div>
  );
}
