import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

const KEY_PREFIX = 'fork:';

const asyncStorage: StateStorage = {
  getItem: (name) => AsyncStorage.getItem(KEY_PREFIX + name),
  setItem: (name, value) => AsyncStorage.setItem(KEY_PREFIX + name, value),
  removeItem: (name) => AsyncStorage.removeItem(KEY_PREFIX + name),
};

export const forkStorage = createJSONStorage(() => asyncStorage);

export async function clearAllData(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(KEY_PREFIX)));
}
