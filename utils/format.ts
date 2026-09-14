import type { Currency } from '@/types/simulation';

const SYMBOLS: Record<Currency, string> = {
  UGX: 'UGX',
  USD: '$',
  KES: 'KSh',
  NGN: '₦',
  EUR: '€',
  GBP: '£',
  INR: '₹',
};

const ZERO_DECIMAL: Currency[] = ['UGX', 'KES', 'NGN', 'INR'];

export function formatMoney(amount: number | undefined, currency: Currency): string {
  if (amount === undefined || Number.isNaN(amount)) return '—';
  const rounded = ZERO_DECIMAL.includes(currency) ? Math.round(amount) : Math.round(amount * 100) / 100;
  const sign = rounded < 0 ? '-' : '';
  const body = Math.abs(rounded).toLocaleString('en-US', {
    maximumFractionDigits: ZERO_DECIMAL.includes(currency) ? 0 : 2,
  });
  const symbol = SYMBOLS[currency];
  return symbol.length > 1 ? `${sign}${symbol} ${body}` : `${sign}${symbol}${body}`;
}

/** Short form: 1.5M, 280K, 2.0M */
export function formatCompact(amount: number | undefined, currency: Currency): string {
  if (amount === undefined || Number.isNaN(amount)) return '—';
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const symbol = SYMBOLS[currency];
  let body: string;
  if (abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(0)}K`;
  else body = abs.toFixed(0);
  return symbol.length > 1 ? `${sign}${symbol} ${body}` : `${sign}${symbol}${body}`;
}

export function parseNumber(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

export function relativeDate(ts: number, now = Date.now()): string {
  const diff = now - ts;
  const day = 86_400_000;
  if (diff < day) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}
