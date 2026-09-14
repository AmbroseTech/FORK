import { CONFIG, isAIConfigured } from '@/constants/config';
import { DemoProvider } from './demoProvider';
import { GroqProvider } from './groqProvider';
import type { AIProvider } from './provider';

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;
  cached = isAIConfigured() ? new GroqProvider() : new DemoProvider();
  return cached;
}

export function aiModeLabel(): string {
  if (isAIConfigured()) return `groq · ${CONFIG.ai.groqModel}`;
  return 'demo · seeded data';
}

export { AIProviderError } from './provider';
export type { AIProvider, DecisionAnalysis } from './provider';
