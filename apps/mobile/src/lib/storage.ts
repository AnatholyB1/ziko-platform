import { MMKV } from 'react-native-mmkv';

/** General-purpose MMKV storage for app preferences */
export const appStorage = new MMKV({ id: 'ziko-app' });

/** Plugin-specific storage */
export const pluginStorage = new MMKV({ id: 'ziko-plugins' });

// Typed helpers
export const storage = {
  set: (key: string, value: string | number | boolean) => appStorage.set(key, value as any),
  getString: (key: string) => appStorage.getString(key),
  getBoolean: (key: string) => appStorage.getBoolean(key),
  getNumber: (key: string) => appStorage.getNumber(key),
  delete: (key: string) => appStorage.delete(key),
  clearAll: () => appStorage.clearAll(),
};
