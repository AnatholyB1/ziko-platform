declare module '@ziko/sounds' {
  export function playSound(name: 'tick' | 'beep' | 'beepHigh' | 'complete' | 'start' | 'rest'): Promise<void>;
  export function playCountdownBeep(secondsLeft: number): Promise<void>;
  export function unloadSounds(): Promise<void>;
  export function isSoundEnabled(): boolean;
  export function setSoundEnabled(enabled: boolean): Promise<void>;
}
