/**
 * Deliberately minimal hand-rolled retry (03-RESEARCH.md "Don't Hand-Roll"
 * exception for a 2-3 call-site need). Intended for transient network-class
 * failures around Storage uploads and Supabase writes ONLY — it must never
 * be wrapped around pure in-memory work such as capImage/capGif (a resize
 * failure is deterministic; retrying only burns time).
 *
 * No CommonJS-directory-global / ESM-module-url-meta usage here
 * (module-system constraint, see README.md "Module System").
 */

// Number of attempts before giving up and rethrowing the last error.
export const RETRY_ATTEMPTS = 3;

// Base delay (ms) for exponential backoff between attempts:
// baseDelayMs * 2 ** attempt, i.e. 500ms then 1000ms with the defaults.
export const RETRY_BASE_DELAY_MS = 500;

/**
 * Invokes `fn`, retrying up to `attempts` times with exponential backoff
 * (`baseDelayMs * 2 ** attempt` between attempts, no delay after the final
 * attempt) before rethrowing the LAST error encountered — so a caller's
 * error_message reflects the most recent failure, not a stale first one.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS,
  baseDelayMs: number = RETRY_BASE_DELAY_MS,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
      }
    }
  }
  throw lastError;
}
