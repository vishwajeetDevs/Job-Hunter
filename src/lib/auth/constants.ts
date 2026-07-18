export const AUTH_ROUTES = {
  signIn: "/sign-in",
  signUp: "/sign-up",
  dashboard: "/dashboard",
} as const;

export const PUBLIC_ROUTES = ["/", AUTH_ROUTES.signIn, AUTH_ROUTES.signUp] as const;

export const PROTECTED_ROUTES = ["/dashboard(.*)"] as const;

export const DEFAULT_SIGN_IN_REDIRECT = AUTH_ROUTES.dashboard;
