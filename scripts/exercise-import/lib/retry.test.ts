// Unit tests for scripts/exercise-import/lib/retry.ts (D-07).
// Uses vi.useFakeTimers() + vi.advanceTimersByTimeAsync() to assert exact
// backoff delays without real waiting.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry, RETRY_ATTEMPTS, RETRY_BASE_DELAY_MS } from './retry';

afterEach(() => {
  vi.useRealTimers();
});

describe('constants', () => {
  it('RETRY_ATTEMPTS is 3', () => {
    expect(RETRY_ATTEMPTS).toBe(3);
  });

  it('RETRY_BASE_DELAY_MS is 500', () => {
    expect(RETRY_BASE_DELAY_MS).toBe(500);
  });
});

describe('withRetry', () => {
  it('invokes a function that succeeds on the first call exactly once and returns its value', async () => {
    const fn = vi.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('invokes a function that throws twice then succeeds exactly 3 times, returning the third value', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('third value');

    const promise = withRetry(fn);
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(result).toBe('third value');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('invokes an always-failing function exactly RETRY_ATTEMPTS times, then rethrows the LAST error', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error attempt 1'))
      .mockRejectedValueOnce(new Error('error attempt 2'))
      .mockRejectedValueOnce(new Error('error attempt 3 - final'));

    const promise = withRetry(fn);
    // Suppress unhandled rejection warnings until we assert below.
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(1000);

    await expect(promise).rejects.toThrow('error attempt 3 - final');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('awaits 500ms between attempt 1 and 2, and 1000ms between attempt 2 and 3', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn);

    // Attempt 1 fires synchronously and fails; attempt 2 is scheduled
    // 500ms later and must not fire before that.
    await vi.advanceTimersByTimeAsync(499);
    expect(fn).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1); // t=500ms: attempt 2 fires and fails

    // Attempt 3 is scheduled 1000ms after attempt 2 and must not fire
    // before that.
    await vi.advanceTimersByTimeAsync(999);
    expect(fn).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1); // t=1500ms: attempt 3 fires and succeeds

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('awaits no delay after the final attempt fails (rejects promptly once attempts are exhausted)', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));

    const promise = withRetry(fn, 2, 500);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(500); // only one backoff delay for 2 attempts

    await expect(promise).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('honors explicit attempts/baseDelayMs arguments overriding the defaults', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('boom'));

    const promise = withRetry(fn, 5, 10);
    promise.catch(() => {});

    // 5 attempts => 4 delays of 10ms, 20ms, 40ms, 80ms.
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await vi.advanceTimersByTimeAsync(40);
    await vi.advanceTimersByTimeAsync(80);

    await expect(promise).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(5);
  });
});
