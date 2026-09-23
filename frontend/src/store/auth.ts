import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tokens, Usage, User } from '../lib/types';

interface AuthState {
  user: User | null;
  tokens: Tokens | null;
  usage: Usage | null;
  setSession: (user: User, tokens: Tokens) => void;
  setUser: (user: User) => void;
  setTokens: (tokens: Tokens) => void;
  setUsage: (usage: Usage | null) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      usage: null,
      setSession: (user, tokens) => set({ user, tokens }),
      setUser: (user) => set({ user }),
      setTokens: (tokens) => set({ tokens }),
      setUsage: (usage) => set({ usage }),
      clear: () => set({ user: null, tokens: null, usage: null }),
    }),
    { name: 'fork.auth', partialize: (s) => ({ user: s.user, tokens: s.tokens }) },
  ),
);
