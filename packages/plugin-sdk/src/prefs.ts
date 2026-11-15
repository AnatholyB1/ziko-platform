import { MMKV } from 'react-native-mmkv';

// Petites preferences booleennes par appareil, partagees par les plugins (ex. lancement automatique de la routine
// de stretching par defaut). Stockage MMKV local : jamais de donnee de sante, jamais synchronise.
let store: MMKV | null = null;
const get = (): MMKV => (store ??= new MMKV({ id: 'plugin-prefs' }));

export function getPluginPref(key: string, fallback = false): boolean {
  try {
    return get().getBoolean(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function setPluginPref(key: string, value: boolean): void {
  try {
    get().set(key, value);
  } catch {
    /* preference non persistee : l'ecran continue sans */
  }
}
