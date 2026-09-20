import { create } from 'zustand';
import { api } from './api';
import type { Usage } from './types';
import { useAuth } from '../store/auth';

export const FORK_COLORS = ['text-fork-a', 'text-fork-b', 'text-fork-c', 'text-fork-d'];
export const FORK_BG = ['bg-fork-a', 'bg-fork-b', 'bg-fork-c', 'bg-fork-d'];

const GUEST_OK = [/^\/app\/fork$/, /^\/app\/futures(\/|$)/, /^\/app\/whatif$/, /^\/app\/pricing$/];
export function guestAllowed(pathname: string) {
  return GUEST_OK.some((r) => r.test(pathname));
}

export function useRefreshUsage() {
  const setUsage = useAuth((s) => s.setUsage);
  return async () => {
    if (!useAuth.getState().tokens) {
      setUsage(null);
      return;
    }
    try {
      setUsage(await api<Usage>('/api/usage'));
    } catch {
      setUsage(null);
    }
  };
}

export function formatUGX(minor: number, currency = 'UGX') {
  return `${currency} ${minor.toLocaleString('en-US')}`;
}

export const useUnread = create<{ unread: number; set: (n: number) => void }>((set) => ({ unread: 0, set: (unread) => set({ unread }) }));
