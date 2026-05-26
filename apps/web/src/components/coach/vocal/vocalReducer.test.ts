import { describe, it, expect } from 'vitest';
import { vocalReducer } from './vocalReducer';

// RED stub — vocalReducer.ts does not exist yet.
// These tests will fail with "Cannot find module './vocalReducer'" until Wave 2 (Plan 01-04).

const mockBlob = new Blob(['audio'], { type: 'audio/webm' });
const mimeType = 'audio/webm';

describe('vocalReducer state transitions', () => {
  it('idle → recording on START_RECORDING', () => {
    const next = vocalReducer({ status: 'idle' }, { type: 'START_RECORDING' });
    expect(next.status).toBe('recording');
  });

  it('recording → transcribing on STOP_RECORDING', () => {
    const next = vocalReducer(
      { status: 'recording', startedAt: Date.now() },
      { type: 'STOP_RECORDING', blob: mockBlob, mimeType }
    );
    expect(next.status).toBe('transcribing');
  });

  it('transcribing → review on TRANSCRIPTION_SUCCESS', () => {
    const next = vocalReducer(
      { status: 'transcribing', blob: mockBlob, mimeType },
      { type: 'TRANSCRIPTION_SUCCESS', transcript: 'Hello' }
    );
    expect(next.status).toBe('review');
  });

  it('transcribing → error on TRANSCRIPTION_ERROR', () => {
    const next = vocalReducer(
      { status: 'transcribing', blob: mockBlob, mimeType },
      { type: 'TRANSCRIPTION_ERROR', message: 'Network error' }
    );
    expect(next.status).toBe('error');
  });

  it('error → transcribing on RETRY', () => {
    const next = vocalReducer(
      { status: 'error', blob: mockBlob, mimeType, message: 'Network error' },
      { type: 'RETRY' }
    );
    expect(next.status).toBe('transcribing');
  });

  it('error → idle on RELAUNCH', () => {
    const next = vocalReducer(
      { status: 'error', blob: mockBlob, mimeType, message: 'Network error' },
      { type: 'RELAUNCH' }
    );
    expect(next.status).toBe('idle');
  });

  it('review → idle on VALIDATE', () => {
    const next = vocalReducer(
      { status: 'review', transcript: 'Hello' },
      { type: 'VALIDATE' }
    );
    expect(next.status).toBe('idle');
  });
});
