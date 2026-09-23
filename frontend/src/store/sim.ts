import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { DEMO_DRAFT, type Draft } from '../engine/demoDraft';
import { recompute } from '../engine/engine';
import type { DecisionContext, Simulation } from '../engine/types';

interface SimState {
  draft: Draft;
  current: Simulation | null;
  category: string | null;
  aiNote: string | null;
  local: boolean;
  /** Server id once the current simulation has been saved as a Fork. */
  savedId: string | null;
  setDraft: (patch: Partial<Draft>) => void;
  resetDraft: () => void;
  loadDemo: () => void;
  setCurrent: (sim: Simulation, meta: { category: string; aiNote: string | null; local: boolean }) => void;
  applyOverrides: (overrides: Partial<DecisionContext>) => void;
  clearOverrides: () => void;
  setSavedId: (id: string | null) => void;
  clearCurrent: () => void;
  resetAll: () => void;
}

const EMPTY: Draft = { decision: '', priorities: ['money'], context: { currency: 'UGX', horizonMonths: 6 } };

export const useSim = create<SimState>()(
  persist(
    (set, get) => ({
      draft: EMPTY,
      current: null,
      category: null,
      aiNote: null,
      local: false,
      savedId: null,
      setDraft: (patch) => set({ draft: { ...get().draft, ...patch } }),
      resetDraft: () => set({ draft: EMPTY }),
      loadDemo: () => set({ draft: DEMO_DRAFT }),
      setCurrent: (sim, meta) => set({ current: sim, savedId: null, ...meta }),
      applyOverrides: (overrides) => {
        const cur = get().current;
        if (cur) set({ current: recompute(cur, { ...cur.overrides, ...overrides }) });
      },
      clearOverrides: () => {
        const cur = get().current;
        if (cur) set({ current: recompute(cur, {}) });
      },
      setSavedId: (savedId) => set({ savedId }),
      clearCurrent: () => set({ current: null, category: null, aiNote: null, savedId: null }),
      resetAll: () => set({ draft: EMPTY, current: null, category: null, aiNote: null, local: false, savedId: null }),
    }),
    { name: 'fork.sim', storage: createJSONStorage(() => sessionStorage) },
  ),
);
