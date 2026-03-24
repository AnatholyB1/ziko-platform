import { Audio } from 'expo-av';
import { appStorage } from './storage';

// Sound assets
const SOUNDS = {
  tick: require('../../assets/sounds/tick.wav'),
  beep: require('../../assets/sounds/beep.wav'),
  beepHigh: require('../../assets/sounds/beep-high.wav'),
  complete: require('../../assets/sounds/complete.wav'),
  start: require('../../assets/sounds/start.wav'),
  rest: require('../../assets/sounds/rest.wav'),
} as const;

type SoundName = keyof typeof SOUNDS;

// Cache loaded sounds
const cache: Partial<Record<SoundName, Audio.Sound>> = {};
let soundEnabled = true;

// Load user preference
appStorage.getBoolean('soundEnabled').then((v) => {
  if (v !== undefined) soundEnabled = v;
});

export async function setSoundEnabled(enabled: boolean) {
  soundEnabled = enabled;
  await appStorage.set('soundEnabled', enabled);
}

export function isSoundEnabled() {
  return soundEnabled;
}

async function getSound(name: SoundName): Promise<Audio.Sound> {
  if (cache[name]) return cache[name]!;
  await Audio.setAudioModeAsync({
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
  });
  const { sound } = await Audio.Sound.createAsync(SOUNDS[name]);
  cache[name] = sound;
  return sound;
}

export async function playSound(name: SoundName) {
  if (!soundEnabled) return;
  try {
    const sound = await getSound(name);
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Fail silently — sound is non-critical
  }
}

/** Play countdown beeps for last 3 seconds */
export async function playCountdownBeep(secondsLeft: number) {
  if (!soundEnabled) return;
  if (secondsLeft === 3 || secondsLeft === 2) {
    await playSound('beep');
  } else if (secondsLeft === 1) {
    await playSound('beepHigh');
  }
}

/** Cleanup all cached sounds */
export async function unloadSounds() {
  for (const sound of Object.values(cache)) {
    try { await sound?.unloadAsync(); } catch {}
  }
  Object.keys(cache).forEach((k) => delete cache[k as SoundName]);
}
