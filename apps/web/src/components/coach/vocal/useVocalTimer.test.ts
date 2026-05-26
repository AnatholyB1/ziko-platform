import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useVocalTimer } from './useVocalTimer';

// RED stub — useVocalTimer.ts does not exist yet.
// These tests will fail with "Cannot find module './useVocalTimer'" until Wave 2.

describe('useVocalTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-stops at 300 seconds', () => {
    const onAutoStop = vi.fn();
    const { start } = useVocalTimer({ onAutoStop });
    start();
    vi.advanceTimersByTime(300_000);
    expect(onAutoStop).toHaveBeenCalledOnce();
  });

  it('formats elapsed time as mm:ss', () => {
    const { formatElapsed } = useVocalTimer({ onAutoStop: vi.fn() });
    expect(formatElapsed(65)).toBe('01:05');
  });
});
