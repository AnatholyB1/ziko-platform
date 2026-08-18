/**
 * Test-account purge — PITR (point-in-time recovery) status check via the
 * Supabase Management API.
 *
 * Requires: SUPABASE_URL and SUPABASE_ACCESS_TOKEN env vars
 * (SUPABASE_ACCESS_TOKEN optional — absence downgrades the result to
 * unknown)
 *
 * D-04: the row export in export.mjs is the unconditional primary safety
 * net; PITR is the secondary backstop behind it, not a co-equal
 * requirement. Its status is read here from the live Management API and
 * never assumed — an unreachable API, a non-OK response, or an absent
 * token all degrade to the explicit `unknown` outcome rather than a guess
 * (T-02-09). Only the read-only backups status endpoint is called; no
 * restore call exists in this file (COVERAGE.md, T-02-14).
 */

const PROJECT_REF_PATTERN = /^([a-z0-9]+)\.supabase\.co$/i;

/**
 * Extracts the project ref from a `https://<ref>.supabase.co` host.
 * Returns null when the host does not match that shape rather than
 * guessing a reference.
 * @param {string | null | undefined} supabaseUrl
 * @returns {string | null}
 */
export function resolveProjectRef(supabaseUrl) {
  if (typeof supabaseUrl !== 'string' || !supabaseUrl) return null;
  let host;
  try {
    ({ host } = new URL(supabaseUrl));
  } catch {
    return null;
  }
  const match = host.match(PROJECT_REF_PATTERN);
  return match ? match[1] : null;
}

/**
 * Reads PITR status from `GET /v1/projects/{ref}/database/backups`. Never
 * throws: an absent access token or an unresolvable project ref returns
 * `unknown` immediately with no request issued; a non-OK response or a
 * rejecting fetch are caught and also degrade to `unknown`. The `unknown`
 * state is a first-class outcome, not an error path — a human decides what
 * to do about it, and it never blocks the export from completing. The
 * detail string is composed only from the HTTP status code and response
 * booleans, never the token or any header value (T-02-10) — this string is
 * written verbatim into the manifest and read aloud during review.
 * @param {{ supabaseUrl: string, accessToken?: string, fetchImpl?: typeof fetch, now?: () => Date }} args
 * @returns {Promise<{ status: 'enabled' | 'disabled' | 'unknown', checked_at: string, detail: string }>}
 */
export async function checkPitrStatus({
  supabaseUrl,
  accessToken,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  const checked_at = now().toISOString();
  const projectRef = resolveProjectRef(supabaseUrl);

  if (!accessToken) {
    return {
      status: 'unknown',
      checked_at,
      detail: 'SUPABASE_ACCESS_TOKEN is not set — PITR status was not checked',
    };
  }
  if (!projectRef) {
    return {
      status: 'unknown',
      checked_at,
      detail: 'SUPABASE_URL does not match a Supabase project host — PITR status was not checked',
    };
  }

  try {
    const response = await fetchImpl(`https://api.supabase.com/v1/projects/${projectRef}/database/backups`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        status: 'unknown',
        checked_at,
        detail: `Management API returned HTTP ${response.status} — PITR status could not be confirmed`,
      };
    }

    const body = await response.json();
    if (typeof body?.pitr_enabled !== 'boolean') {
      return {
        status: 'unknown',
        checked_at,
        detail: 'Management API response did not include pitr_enabled',
      };
    }

    return {
      status: body.pitr_enabled ? 'enabled' : 'disabled',
      checked_at,
      detail: `Management API reported pitr_enabled=${body.pitr_enabled}, walg_enabled=${body.walg_enabled ?? 'unknown'}`,
    };
  } catch (err) {
    return {
      status: 'unknown',
      checked_at,
      detail: `Management API request failed: ${err instanceof Error ? err.message : 'unknown error'}`,
    };
  }
}
