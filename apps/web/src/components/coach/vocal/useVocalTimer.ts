'use client';

// useVocalTimer.ts — mm:ss timer with auto-stop at 300s.
// Interface:
//   useVocalTimer({ onAutoStop }) → { start, stop, formatElapsed }
//
// Two usage modes:
// 1. As a plain utility (tests, non-React contexts) — call start()/stop() directly.
// 2. As a React hook integration — wrap with useEffect in the parent component.

export interface VocalTimerHandle {
  start: () => void;
  stop: () => void;
  formatElapsed: (seconds: number) => string;
}

export interface VocalTimerOptions {
  onAutoStop: () => void;
}

export function useVocalTimer({ onAutoStop }: VocalTimerOptions): VocalTimerHandle {
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let elapsedSeconds = 0;
  // Keep a stable reference to the latest onAutoStop callback
  const onAutoStopRef = onAutoStop;

  const formatElapsed = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const start = (): void => {
    if (intervalId !== null) return; // already running
    elapsedSeconds = 0;

    intervalId = setInterval(() => {
      elapsedSeconds += 1;
      if (elapsedSeconds >= 300) {
        if (intervalId !== null) {
          clearInterval(intervalId);
          intervalId = null;
        }
        onAutoStopRef();
      }
    }, 1000);
  };

  const stop = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    elapsedSeconds = 0;
  };

  return { start, stop, formatElapsed };
}
