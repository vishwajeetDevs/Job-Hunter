import { SignUp } from "@clerk/nextjs";

import { AUTH_ROUTES } from "@/lib/auth/constants";
import { SITE_NAME } from "@/lib/constants";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4 py-12">
      <div className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Get started
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Create your {SITE_NAME} account
        </h1>
      </div>

      <SignUp
        routing="path"
        path={AUTH_ROUTES.signUp}
        signInUrl={AUTH_ROUTES.signIn}
        forceRedirectUrl={AUTH_ROUTES.dashboard}
        fallbackRedirectUrl={AUTH_ROUTES.dashboard}
      />
    </div>
  );
}
