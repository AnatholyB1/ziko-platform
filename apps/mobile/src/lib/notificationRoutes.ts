// Prefixes a push-notification deep link is allowed to navigate to.
// Keep in sync with apps/mobile/app/(app)/ route segments.
const ALLOWED_ROUTE_PREFIXES = [
  '/(app)/ai',
  '/(app)/notifications',
  '/(app)/workout',
  '/(app)/profile',
  '/(app)/(plugins)/',
];

export function isAllowedNotificationRoute(url: string): boolean {
  if (!url.startsWith('/')) return false;
  return ALLOWED_ROUTE_PREFIXES.some((prefix) => url.startsWith(prefix));
}
