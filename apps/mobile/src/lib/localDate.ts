/** Returns YYYY-MM-DD for the device's local date, not UTC. */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Local date of an ISO timestamp (e.g. `started_at`, returned in UTC by Postgres). */
export function localDateKeyFromISO(iso: string): string {
  return localDateKey(new Date(iso));
}

/**
 * Consecutive local days (ending today) that contain at least one of the given ISO timestamps.
 * `now` is injectable so midnight edge cases can be tested.
 */
export function consecutiveDayStreak(isoTimestamps: readonly string[], now: Date = new Date()): number {
  const days = new Set(isoTimestamps.map(localDateKeyFromISO));
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  while (days.has(localDateKey(cursor))) {
    streak++;
    // setDate keeps local calendar days correct across DST changes (86400000 ms steps do not).
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
