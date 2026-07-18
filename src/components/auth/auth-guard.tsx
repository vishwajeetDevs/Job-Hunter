import { AUTH_ROUTES } from "@/lib/auth/constants";
import { requireAuth } from "@/lib/auth/require-auth";

type AuthGuardProps = {
  children: React.ReactNode;
  redirectTo?: string;
};

export async function AuthGuard({
  children,
  redirectTo = AUTH_ROUTES.signIn,
}: AuthGuardProps) {
  await requireAuth(redirectTo);
  return <>{children}</>;
}
