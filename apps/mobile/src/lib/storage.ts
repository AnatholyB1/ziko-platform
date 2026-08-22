import AsyncStorage from '@react-native-async-storage/async-storage';

const prefix = (ns: string, key: string) => `${ns}:${key}`;

async function clearNamespace(ns: string): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const nsKeys = keys.filter((k) => k.startsWith(`${ns}:`));
  if (nsKeys.length > 0) await AsyncStorage.multiRemove(nsKeys);
}

/** General-purpose async storage for app preferences */
export const appStorage = {
  set: (key: string, value: string | number | boolean) =>
    AsyncStorage.setItem(prefix('app', key), String(value)),
  getString: (key: string) => AsyncStorage.getItem(prefix('app', key)),
  getBoolean: async (key: string) => {
    const v = await AsyncStorage.getItem(prefix('app', key));
    return v === null ? undefined : v === 'true';
  },
  getNumber: async (key: string) => {
    const v = await AsyncStorage.getItem(prefix('app', key));
    return v === null ? undefined : Number(v);
  },
  delete: (key: string) => AsyncStorage.removeItem(prefix('app', key)),
  clearAll: () => clearNamespace('app'),
};

/** Plugin-specific async storage */
export const pluginStorage = {
  set: (key: string, value: string | number | boolean) =>
    AsyncStorage.setItem(prefix('plugin', key), String(value)),
  getString: (key: string) => AsyncStorage.getItem(prefix('plugin', key)),
  delete: (key: string) => AsyncStorage.removeItem(prefix('plugin', key)),
  clearAll: () => clearNamespace('plugin'),
};

// Typed helpers (async)
export const storage = appStorage;
