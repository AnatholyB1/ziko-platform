'use client';

// useVocalRecorder.ts — MediaRecorder hook with mimeType negotiation.
// Returns a recorder object with start(), stop(), and mimeType.
// Works both as a plain factory (for tests) and as a custom hook (for components).

import { useRef } from 'react';

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

  // useRef keeps these stable across re-renders — plain `let` resets to null on every render
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const currentMimeTypeRef = useRef<string>(mimeType);

  const start = async (): Promise<void> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access requires a secure context (HTTPS or localhost).');
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];

    // Re-negotiate in case mimeType state has changed (edge case for mobile)
    currentMimeTypeRef.current = getSupportedMimeType();

    const options: MediaRecorderOptions = currentMimeTypeRef.current
      ? { mimeType: currentMimeTypeRef.current }
      : {};

    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.start(250); // 250ms timeslice for smooth mobile streaming
  };

  const stop = (): Promise<{ blob: Blob; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      if (!recorderRef.current) {
        reject(new Error('No recorder active'));
        return;
      }

      const recorder = recorderRef.current;
      const chunks = chunksRef.current;
      const resolvedMimeType = currentMimeTypeRef.current;

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
