import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { forkStorage } from '@/services/storage';
import type { Currency } from '@/types/simulation';

interface SettingsState {
  currency: Currency;
  haptics: boolean;
  onboarded: boolean;
  setCurrency: (c: Currency) => void;
  setHaptics: (on: boolean) => void;
  setOnboarded: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: 'UGX',
      haptics: true,
      onboarded: false,
      setCurrency: (currency) => set({ currency }),
      setHaptics: (haptics) => set({ haptics }),
      setOnboarded: () => set({ onboarded: true }),
    }),
    { name: 'settings', storage: forkStorage },
  ),
);
