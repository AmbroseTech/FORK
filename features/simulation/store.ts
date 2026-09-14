import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { forkStorage } from '@/services/storage';
import { getAIProvider } from '@/services/ai';
import type { Currency, DecisionContext, DecisionInput, Priority, Simulation } from '@/types/simulation';
import { uid } from '@/utils/id';
import { DEMO_DRAFT, type Draft } from './demoDraft';
import { buildSimulation, recompute } from './engine';

export type SimulationStatus = 'idle' | 'running' | 'done' | 'error';

interface SimulationState {
  draft: Draft;
  current: Simulation | null;
  status: SimulationStatus;
  error: string | null;
  setDecision: (decision: string) => void;
  togglePriority: (p: Priority) => void;
  setContext: (patch: Partial<DecisionContext>) => void;
  resetDraft: (currency: Currency) => void;
  loadDemoDraft: () => void;
  run: () => Promise<Simulation | null>;
  applyOverrides: (overrides: Partial<DecisionContext>) => void;
  clearOverrides: () => void;
  setCurrent: (sim: Simulation | null) => void;
}

const emptyDraft = (currency: Currency): Draft => ({
  decision: '',
  priorities: [],
  context: { currency, horizonMonths: 6 },
});

export const useSimulationStore = create<SimulationState>()(
  persist(
    (set, get) => ({
      draft: emptyDraft('UGX'),
      current: null,
      status: 'idle',
      error: null,

      setDecision: (decision) => set((s) => ({ draft: { ...s.draft, decision } })),
      togglePriority: (p) =>
        set((s) => ({
          draft: {
            ...s.draft,
            priorities: s.draft.priorities.includes(p)
              ? s.draft.priorities.filter((x) => x !== p)
              : [...s.draft.priorities, p],
          },
        })),
      setContext: (patch) => set((s) => ({ draft: { ...s.draft, context: { ...s.draft.context, ...patch } } })),
      resetDraft: (currency) => set({ draft: emptyDraft(currency), status: 'idle', error: null }),
      loadDemoDraft: () => set({ draft: { ...DEMO_DRAFT, context: { ...DEMO_DRAFT.context } }, status: 'idle', error: null }),

      run: async () => {
        const { draft } = get();
        const input: DecisionInput = {
          decision: draft.decision.trim(),
          priorities: draft.priorities,
          context: draft.context,
        };
        set({ status: 'running', error: null });
        const provider = getAIProvider();
        try {
          const seeds = await provider.generateScenarios(input);
          let sim = buildSimulation({ id: uid('sim'), input, seeds, source: provider.source });
          try {
            const rec = await provider.generateRecommendation(sim);
            sim = { ...sim, recommendation: rec };
          } catch {
            // deterministic recommendation already present
          }
          set({ current: sim, status: 'done' });
          return sim;
        } catch (e) {
          set({ status: 'error', error: e instanceof Error ? e.message : 'Simulation failed' });
          return null;
        }
      },

      applyOverrides: (overrides) => {
        const { current } = get();
        if (!current) return;
        set({ current: recompute(current, { ...current.overrides, ...overrides }) });
      },
      clearOverrides: () => {
        const { current } = get();
        if (!current) return;
        set({ current: recompute(current, {}) });
      },
      setCurrent: (sim) => set({ current: sim, status: sim ? 'done' : 'idle' }),
    }),
    {
      name: 'simulation',
      storage: forkStorage,
      partialize: (s) => ({ draft: s.draft, current: s.current }),
    },
  ),
);
