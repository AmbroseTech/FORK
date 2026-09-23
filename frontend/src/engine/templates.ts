/**
 * Seeded scenario templates used in DEMO mode and as an offline fallback when
 * the backend/AI is unavailable. Not an AI: picks a template matching the
 * shape of the decision. The UI labels this output as seeded demo data.
 * The JSON is shared with the backend (backend/app/services/ai/data/templates.json).
 */
import data from './templates.json';
import type { ScenarioSeed } from './types';

export type Template = { match: RegExp | null; category: string; variables: string[]; scenarios: ScenarioSeed[] };

type RawTemplate = Omit<Template, 'match'> & { match: string | null };

const raw = data as { templates: RawTemplate[]; generic: RawTemplate };

const TEMPLATES: Template[] = raw.templates.map((t) => ({ ...t, match: t.match ? new RegExp(t.match, 'i') : null }));
const GENERIC: Template = { ...raw.generic, match: null };

export function pickTemplate(decision: string): Template {
  return TEMPLATES.find((t) => t.match?.test(decision)) ?? GENERIC;
}
