import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVocalRecorder } from './useVocalRecorder';

// RED stub — useVocalRecorder.ts does not exist yet.
// These tests will fail with "Cannot find module './useVocalRecorder'" until Wave 2.

describe('useVocalRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces a non-empty blob on stop', async () => {
    const recorder = useVocalRecorder();
    await recorder.start();
    const result = await recorder.stop();
    expect(result.blob.size).toBeGreaterThan(0);
  });

  it('negotiates mimeType via isTypeSupported', () => {
    const isTypeSupported = vi.spyOn(MediaRecorder, 'isTypeSupported').mockReturnValue(true);
    const recorder = useVocalRecorder();
    expect(recorder.mimeType).toBeTruthy();
    expect(isTypeSupported).toHaveBeenCalled();
  });
});
