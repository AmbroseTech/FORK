/**
 * Groq provider — uses Groq's OpenAI-compatible chat completions API with an
 * open model (default: llama-3.3-70b-versatile). Every response is requested
 * as JSON and validated with zod before the app trusts it.
 */
import { z } from 'zod';
import { CONFIG } from '@/constants/config';
import { deterministicRecommendation, effectiveContext } from '@/features/simulation/engine';
import { parseWhatIf } from '@/features/simulation/whatIf';
import { computePatterns } from '@/features/insights/patterns';
import {
  RecommendationSchema,
  ScenarioSeedListSchema,
  WhatIfSchema,
  type DecisionContext,
  type DecisionInput,
  type Fork,
  type Recommendation,
  type ScenarioSeed,
  type Simulation,
  type WhatIf,
} from '@/types/simulation';
import { formatMoney } from '@/utils/format';
import { AIProviderError, type AIProvider, type DecisionAnalysis } from './provider';

const SYSTEM = `You are the scenario engine inside FORK, a decision simulator.
You never predict the future or give professional financial, medical or legal advice.
You describe plausible scenarios and trade-offs using cautious language ("this scenario suggests", "this projection assumes").
Always answer with a single JSON object and nothing else.`;

const AnalysisSchema = z.object({
  category: z.string().max(40),
  variables: z.array(z.string().max(60)).max(8),
  suggestedQuestions: z.array(z.string().max(120)).max(4),
});

function describeContext(ctx: DecisionContext): string {
  const money = (n?: number) => (n === undefined ? 'unknown' : formatMoney(n, ctx.currency));
  return [
    `currency: ${ctx.currency}`,
    `savings: ${money(ctx.savings)}`,
    `monthly income: ${money(ctx.monthlyIncome)}`,
    `monthly essential expenses: ${money(ctx.monthlyExpenses)}`,
    `one-off cost of the decision: ${money(ctx.cost)}`,
    `goal: ${ctx.goal ?? 'not stated'}${ctx.goalAmount ? ` (${money(ctx.goalAmount)})` : ''}`,
    `time horizon: ${ctx.horizonMonths} months`,
  ].join('\n');
}

export class GroqProvider implements AIProvider {
  readonly source = 'groq' as const;

  private async chat<T>(schema: z.ZodType<T>, user: string, temperature = 0.4): Promise<T> {
    if (!CONFIG.ai.groqApiKey) throw new AIProviderError('Groq API key missing', 'not_configured');
    let res: Response;
    try {
      res = await fetch(`${CONFIG.ai.groqBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${CONFIG.ai.groqApiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.ai.groqModel,
          temperature,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: user },
          ],
        }),
      });
    } catch (e) {
      throw new AIProviderError(e instanceof Error ? e.message : 'Network error', 'network');
    }
    if (res.status === 429) throw new AIProviderError('Rate limited by Groq', 'rate_limited');
    if (!res.ok) throw new AIProviderError(`Groq responded ${res.status}`, 'network');

    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new AIProviderError('Empty model output', 'invalid_output');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AIProviderError('Model output was not JSON', 'invalid_output');
    }
    const result = schema.safeParse(parsed);
    if (!result.success) throw new AIProviderError(`Model output failed validation: ${result.error.message}`, 'invalid_output');
    return result.data;
  }

  async analyzeDecision(input: DecisionInput): Promise<DecisionAnalysis> {
    return this.chat(
      AnalysisSchema,
      `Decision: "${input.decision}"
Priorities: ${input.priorities.join(', ') || 'none stated'}
Context:
${describeContext(input.context)}

Return JSON: {"category": one of Money|Career|Education|Business|Relationships|Lifestyle, "variables": key variables that drive this decision (max 8 short strings), "suggestedQuestions": up to 3 short questions whose answers would most improve the simulation (only for missing context)}`,
      0.2,
    );
  }

  async generateScenarios(input: DecisionInput): Promise<ScenarioSeed[]> {
    const result = await this.chat(
      ScenarioSeedListSchema,
      `Decision: "${input.decision}"
Priorities: ${input.priorities.join(', ') || 'none stated'}
Context:
${describeContext(input.context)}

Propose exactly 3 distinct, realistic scenarios (paths the user could take). For each, set numeric modifiers that a deterministic engine will apply to the context:
- costMultiplier: fraction of the one-off cost paid (0 = no cost, 1 = full cost, 0.65 = cheaper option)
- delayMonths: months before the cost is paid / path begins (0 = now)
- incomeMultiplier: effect on monthly income (1 = unchanged, 0.4 = quits job, 1.2 = raise)
- expenseMultiplier: effect on monthly expenses (1 = unchanged)
- benefitFactor: 0..1 non-financial upside (career, learning, lifestyle) the path unlocks
- reversibility: 0..1 how easily the path can be undone
- extraMonthlyIncome and extraIncomeStartMonth: additional income stream if the path creates one (else 0)

Return JSON: {"scenarios":[{"title": max 4 words in imperative form e.g. "Buy now","description": 1-2 sentences,"advantages":[3 short strings],"tradeoffs":[3 short strings],"modifiers":{...}}]}`,
      0.5,
    );
    return result.scenarios;
  }

  async explainTradeoffs(sim: Simulation): Promise<string> {
    const schema = z.object({ explanation: z.string().max(400) });
    const r = await this.chat(
      schema,
      `Decision: "${sim.input.decision}"
Scenarios and computed estimated-fit metrics (0-100):
${sim.scenarios.map((s) => `${s.letter}. ${s.title}: score ${s.score}, financial ${s.metrics.financial}, opportunity ${s.metrics.opportunity}, goal ${s.metrics.goal}, risk control ${s.metrics.risk}, flexibility ${s.metrics.flexibility}`).join('\n')}

In two sentences, explain the central trade-off between these paths for this user. Return JSON: {"explanation": string}`,
    );
    return r.explanation;
  }

  async generateRecommendation(sim: Simulation): Promise<Recommendation> {
    const ctx = effectiveContext(sim);
    const fallback = deterministicRecommendation(sim.scenarios, sim.input.priorities, ctx);
    try {
      const r = await this.chat(
        RecommendationSchema,
        `Decision: "${sim.input.decision}"
Priorities: ${sim.input.priorities.join(', ') || 'none stated'}
Context:
${describeContext(ctx)}
Scenarios with estimated-fit metrics (0-100, computed deterministically):
${sim.scenarios.map((s) => `id=${s.id} ${s.letter}. ${s.title}: score ${s.score}, financial ${s.metrics.financial}, opportunity ${s.metrics.opportunity}, goal ${s.metrics.goal}, risk control ${s.metrics.risk}, flexibility ${s.metrics.flexibility}, lowest balance ${formatMoney(s.minBalance, ctx.currency)}, projected ${formatMoney(s.projectedBalance, ctx.currency)}`).join('\n')}

The highest score is ${fallback.scenarioId}. Pick the scenario that best fits the user's priorities (usually the highest score; you may pick another only with a clear reason). Write "take": one sentence using cautious language ("appears to", "suggests"). Write "why": 3-4 short bullet strings referencing concrete numbers. Return JSON: {"scenarioId": string, "take": string, "why": string[]}`,
      );
      return sim.scenarios.some((s) => s.id === r.scenarioId) ? r : fallback;
    } catch (e) {
      if (e instanceof AIProviderError && e.code === 'not_configured') throw e;
      return fallback;
    }
  }

  async interpretWhatIf(text: string, ctx: DecisionContext): Promise<WhatIf | null> {
    const local = parseWhatIf(text, ctx);
    if (local) return local;
    try {
      return await this.chat(
        WhatIfSchema,
        `Current context:
${describeContext(ctx)}

The user asks: "what if ${text}"
Translate this into numeric overrides for the context (absolute values in ${ctx.currency}, only for fields that change). If it cannot be expressed numerically, return {"summary":"","overrides":{}}.
Return JSON: {"summary": short label max 8 words, "overrides": {"savings"?: number, "monthlyIncome"?: number, "monthlyExpenses"?: number, "cost"?: number, "horizonMonths"?: number}}`,
        0.1,
      ).then((r) => (Object.keys(r.overrides).length ? r : null));
    } catch {
      return null;
    }
  }

  async generateInsight(forks: Fork[]): Promise<string> {
    const report = computePatterns(forks);
    if (report.patterns.length === 0) return report.headline;
    const schema = z.object({ insight: z.string().max(240) });
    try {
      const r = await this.chat(
        schema,
        `A user's decision history summary:
${report.patterns.map((p) => `- ${p.title}: ${p.detail}`).join('\n')}
Outcomes: better ${report.stats.outcomes.better}, expected ${report.stats.outcomes.expected}, worse ${report.stats.outcomes.worse}.

Write ONE warm, specific, non-judgemental sentence (max 30 words) describing this person's decision pattern, starting with "You". Return JSON: {"insight": string}`,
      );
      return r.insight;
    } catch {
      return report.headline;
    }
  }
}
