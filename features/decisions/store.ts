import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { forkStorage } from '@/services/storage';
import type { Fork, OutcomeRating, Simulation } from '@/types/simulation';
import { uid } from '@/utils/id';

interface DecisionsState {
  forks: Fork[];
  save: (simulation: Simulation) => Fork;
  update: (id: string, simulation: Simulation) => void;
  decide: (id: string, scenarioId: string) => void;
  recordOutcome: (id: string, rating: OutcomeRating, note: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useDecisionsStore = create<DecisionsState>()(
  persist(
    (set, get) => ({
      forks: [],
      save: (simulation) => {
        const existing = get().forks.find((f) => f.simulation.id === simulation.id);
        if (existing) {
          const updated = { ...existing, simulation };
          set((s) => ({ forks: s.forks.map((f) => (f.id === existing.id ? updated : f)) }));
          return updated;
        }
        const fork: Fork = { id: uid('fork'), simulation, status: 'pending' };
        set((s) => ({ forks: [fork, ...s.forks] }));
        return fork;
      },
      update: (id, simulation) =>
        set((s) => ({ forks: s.forks.map((f) => (f.id === id ? { ...f, simulation } : f)) })),
      decide: (id, scenarioId) =>
        set((s) => ({
          forks: s.forks.map((f) =>
            f.id === id ? { ...f, status: 'decided', chosenScenarioId: scenarioId, decidedAt: Date.now() } : f,
          ),
        })),
      recordOutcome: (id, rating, note) =>
        set((s) => ({
          forks: s.forks.map((f) =>
            f.id === id ? { ...f, status: 'reviewed', outcome: { rating, note, recordedAt: Date.now() } } : f,
          ),
        })),
      remove: (id) => set((s) => ({ forks: s.forks.filter((f) => f.id !== id) })),
      clear: () => set({ forks: [] }),
    }),
    { name: 'decisions', storage: forkStorage },
  ),
);

export const selectActiveCount = (forks: Fork[]): number => forks.filter((f) => f.status === 'pending').length;
