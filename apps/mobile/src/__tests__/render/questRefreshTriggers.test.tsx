import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useQuestRefreshTriggers } from '../../hooks/useQuestRefreshTriggers';
import { msUntilNextLocalMidnight } from '../../lib/homeQuests';
import { emitAppState } from './stubs/react-native';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ trigger }: { trigger: () => void }) {
  useQuestRefreshTriggers(true, trigger);
  return null;
}

describe('msUntilNextLocalMidnight', () => {
  it('counts down to the next local midnight', () => {
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 20, 23, 59, 0))).toBe(60_000);
    expect(msUntilNextLocalMidnight(new Date(2026, 10, 20, 0, 0, 0))).toBe(24 * 3600_000);
  });
});

describe('useQuestRefreshTriggers (D-07, audit M3)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires at local midnight (+1 s), then again the next midnight ; stops on unmount', async () => {
    vi.setSystemTime(new Date(2026, 10, 20, 23, 59, 0));
    const trigger = vi.fn();
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Probe trigger={trigger} />); });
    await act(async () => { vi.advanceTimersByTime(59_000); });
    expect(trigger).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(2_000); });
    expect(trigger).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(24 * 3600_000); });
    expect(trigger).toHaveBeenCalledTimes(2);
    await act(async () => { root.unmount(); });
    await act(async () => { vi.advanceTimersByTime(48 * 3600_000); });
    expect(trigger).toHaveBeenCalledTimes(2);
  });

  it('fires on AppState active only', async () => {
    const trigger = vi.fn();
    const root = createRoot(document.createElement('div'));
    await act(async () => { root.render(<Probe trigger={trigger} />); });
    emitAppState('background');
    expect(trigger).not.toHaveBeenCalled();
    emitAppState('active');
    expect(trigger).toHaveBeenCalledTimes(1);
    await act(async () => { root.unmount(); });
    emitAppState('active');
    expect(trigger).toHaveBeenCalledTimes(1);
  });
});
