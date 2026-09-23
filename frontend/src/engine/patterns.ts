import type { Fork } from './types';

export interface Pattern {
  id: string;
  title: string;
  detail: string;
  strength: number; // 0..100
}

export interface PatternReport {
  headline: string;
  patterns: Pattern[];
  stats: {
    total: number;
    decided: number;
    reviewed: number;
    followedRecommendation: number;
    outcomes: { better: number; expected: number; worse: number };
  };
}

export function computePatterns(forks: Fork[]): PatternReport {
  const decided = forks.filter((f) => f.status !== 'pending' && f.chosenScenarioId);
  const reviewed = forks.filter((f) => f.outcome);
  const followed = decided.filter((f) => f.chosenScenarioId === f.simulation.recommendation.scenarioId);

  const outcomes = { better: 0, expected: 0, worse: 0 };
  reviewed.forEach((f) => {
    if (f.outcome) outcomes[f.outcome.rating] += 1;
  });

  const patterns: Pattern[] = [];

  if (decided.length >= 2) {
    const chosen = decided
      .map((f) => f.simulation.scenarios.find((s) => s.id === f.chosenScenarioId))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const avg = (key: 'opportunity' | 'risk' | 'flexibility' | 'financial') =>
      chosen.reduce((acc, s) => acc + s.metrics[key], 0) / Math.max(chosen.length, 1);
    const immediacy = chosen.filter((s) => s.modifiers.delayMonths === 0).length / chosen.length;

    if (immediacy >= 0.66) {
      patterns.push({
        id: 'immediacy',
        title: 'You favour acting now',
        detail: `${Math.round(immediacy * 100)}% of your chosen paths start immediately. Speed is a strength — check the buffer each time.`,
        strength: Math.round(immediacy * 100),
      });
    } else if (immediacy <= 0.34) {
      patterns.push({
        id: 'patience',
        title: 'You tend to wait',
        detail: `${Math.round((1 - immediacy) * 100)}% of your chosen paths include a delay. Ask whether the delay is strategic or avoidance.`,
        strength: Math.round((1 - immediacy) * 100),
      });
    }

    if (avg('opportunity') > avg('risk') + 10) {
      patterns.push({
        id: 'upside',
        title: 'You prioritise upside over safety',
        detail: `Chosen paths average opportunity ${Math.round(avg('opportunity'))} vs risk control ${Math.round(avg('risk'))}.`,
        strength: Math.round(avg('opportunity')),
      });
    } else if (avg('risk') > avg('opportunity') + 10) {
      patterns.push({
        id: 'safety',
        title: 'You protect stability first',
        detail: `Chosen paths average risk control ${Math.round(avg('risk'))} vs opportunity ${Math.round(avg('opportunity'))}.`,
        strength: Math.round(avg('risk')),
      });
    }

    const followRate = followed.length / decided.length;
    patterns.push({
      id: 'follow',
      title: followRate >= 0.5 ? "You usually align with FORK's take" : 'You often overrule the recommendation',
      detail: `${followed.length} of ${decided.length} decisions matched the highest-fit scenario.`,
      strength: Math.round(followRate * 100),
    });
  }

  if (reviewed.length >= 2) {
    if (outcomes.worse > outcomes.better) {
      patterns.push({
        id: 'underestimate',
        title: 'You tend to underestimate long-term costs',
        detail: `${outcomes.worse} of ${reviewed.length} reviewed decisions went worse than expected. Try the "expenses +15%" what-if before deciding.`,
        strength: Math.round((outcomes.worse / reviewed.length) * 100),
      });
    } else if (outcomes.better > outcomes.worse) {
      patterns.push({
        id: 'conservative',
        title: 'Your projections run conservative',
        detail: `${outcomes.better} of ${reviewed.length} reviewed decisions went better than expected. You may have room to be bolder.`,
        strength: Math.round((outcomes.better / reviewed.length) * 100),
      });
    }
  }

  let headline: string;
  if (forks.length === 0) headline = 'Run your first simulation to start building your decision profile.';
  else if (decided.length === 0) headline = 'Mark a decision as made to unlock your first pattern.';
  else if (patterns.length === 0) headline = 'A couple more decisions and your patterns will start to show.';
  else headline = patterns[0].detail;

  return {
    headline,
    patterns,
    stats: {
      total: forks.length,
      decided: decided.length,
      reviewed: reviewed.length,
      followedRecommendation: followed.length,
      outcomes,
    },
  };
}
