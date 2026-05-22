const NEXT_PARAM_ALLOWLIST = [
  '/coach/onboarding',
  '/coach/dashboard',
  '/coach/settings',
  '/redeem',
] as const;

// Phase 25 — dynamic short deep-link: /r/<6 chars from [A-Z2-9]>
const REDEEM_DEEPLINK_RE = /^\/r\/[A-Z2-9]{6}$/;

export function safeNext(next: string | null): string {
  if (!next) return '/coach/dashboard';
  if (NEXT_PARAM_ALLOWLIST.includes(next as typeof NEXT_PARAM_ALLOWLIST[number])) return next;
  if (REDEEM_DEEPLINK_RE.test(next)) return next;
  return '/coach/dashboard';
}
