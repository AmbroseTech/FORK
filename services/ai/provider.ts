import type {
  DecisionContext,
  DecisionInput,
  Fork,
  Recommendation,
  ScenarioSeed,
  Simulation,
  Source,
  WhatIf,
} from '@/types/simulation';

export interface DecisionAnalysis {
  category: string;
  variables: string[];
  /** Fields the model thinks would most improve the simulation. */
  suggestedQuestions: string[];
}

/**
 * Provider abstraction. The UI never talks to a model directly; it only sees
 * validated, structured results. Swap implementations via `getAIProvider()`.
 */
export interface AIProvider {
  readonly source: Source;
  analyzeDecision(input: DecisionInput): Promise<DecisionAnalysis>;
  generateScenarios(input: DecisionInput): Promise<ScenarioSeed[]>;
  explainTradeoffs(simulation: Simulation): Promise<string>;
  generateRecommendation(simulation: Simulation): Promise<Recommendation>;
  interpretWhatIf(text: string, ctx: DecisionContext): Promise<WhatIf | null>;
  generateInsight(forks: Fork[]): Promise<string>;
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly code: 'network' | 'invalid_output' | 'not_configured' | 'rate_limited' = 'network',
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}
