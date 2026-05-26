'use client';

// useVocalRecorder.ts — MediaRecorder hook with mimeType negotiation.
// Returns a recorder object with start(), stop(), and mimeType.
// Works both as a plain factory (for tests) and as a custom hook (for components).

const MIME_TYPE_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  '',
] as const;

function getSupportedMimeType(): string {
  for (const candidate of MIME_TYPE_CANDIDATES) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

export interface VocalRecorder {
  mimeType: string;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mimeType: string }>;
}

export function useVocalRecorder(): VocalRecorder {
  // Negotiate mimeType eagerly at construction time (so tests can spy on isTypeSupported)
  const mimeType = getSupportedMimeType();

  let recorderRef: MediaRecorder | null = null;
  let chunksRef: BlobPart[] = [];
  let currentMimeType: string = mimeType;

  const start = async (): Promise<void> => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef = [];

    // Re-negotiate in case mimeType state has changed (edge case for mobile)
    currentMimeType = getSupportedMimeType();

    const options: MediaRecorderOptions = currentMimeType
      ? { mimeType: currentMimeType }
      : {};

    const recorder = new MediaRecorder(stream, options);
    recorderRef = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.push(event.data);
      }
    };

    recorder.start(250); // 250ms timeslice for smooth mobile streaming
  };

  const stop = (): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (!recorderRef) {
        reject(new Error('No recorder active'));
        return;
      }

      const recorder = recorderRef;
      const chunks = chunksRef;
      const resolvedMimeType = currentMimeType;

      recorder.onstop = () => {
        // Release mic tracks
        recorder.stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunks, {
          type: resolvedMimeType || 'audio/webm',
        });
        resolve({ blob, mimeType: resolvedMimeType });
      };

      recorder.stop();
    });
  };

  return { mimeType, start, stop };
}
