import { describe, it, expect, vi, beforeEach } from 'vitest';

// GREEN — implementation exists in Wave 2 (Plan 01-04).
// MediaRecorder and navigator.mediaDevices are mocked below for node test environment.
// React's useRef is mocked so the hook can be called outside renderHook.

// --- Mock React useRef so the hook works in a plain node/happy-dom environment ---
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useRef: <T>(initialValue: T) => ({ current: initialValue }),
  };
});

import { useVocalRecorder } from './useVocalRecorder';

// --- MediaRecorder mock ---
class MockMediaRecorder {
  static isTypeSupported = vi.fn().mockReturnValue(true);
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: { getTracks: () => Array<{ stop: () => void }> };
  _mimeType: string;

  constructor(stream: MediaStream, options?: { mimeType?: string }) {
    this._mimeType = options?.mimeType ?? '';
    this.stream = stream as unknown as { getTracks: () => Array<{ stop: () => void }> };
  }

  start(_timeslice?: number) {
    // Simulate a single data chunk after start
    setTimeout(() => {
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(['audio-data'], { type: this._mimeType || 'audio/webm' }) });
      }
    }, 0);
  }

  stop() {
    setTimeout(() => {
      if (this.onstop) {
        this.onstop();
      }
    }, 0);
  }
}

const mockStream = {
  getTracks: () => [{ stop: vi.fn() }],
} as unknown as MediaStream;

Object.defineProperty(global, 'MediaRecorder', {
  value: MockMediaRecorder,
  writable: true,
});

Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(mockStream),
    },
  },
  writable: true,
});

describe('useVocalRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true);
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockResolvedValue(mockStream);
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
