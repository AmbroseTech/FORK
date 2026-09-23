/**
 * Thin fetch wrapper for the FORK backend.
 * - Attaches the bearer access token.
 * - Transparently refreshes once on 401 (refresh-token rotation).
 * - Never holds AI or payment provider secrets: those live server-side only.
 */
import { useAuth } from '../store/auth';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, message: string, detail: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const { tokens, setTokens, clear } = useAuth.getState();
  if (!tokens?.refresh_token) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refresh_token }),
    })
      .then(async (r) => {
        if (!r.ok) {
          clear();
          return false;
        }
        setTokens(await r.json());
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

function messageFrom(detail: unknown, fallback: string): string {
  if (typeof detail === 'string') return detail;
  if (detail && typeof detail === 'object') {
    const d = detail as { message?: unknown; detail?: unknown };
    if (typeof d.message === 'string') return d.message;
    if (typeof d.detail === 'string') return d.detail;
    if (Array.isArray(d.detail) && d.detail[0] && typeof d.detail[0] === 'object') {
      const first = d.detail[0] as { msg?: unknown };
      if (typeof first.msg === 'string') return first.msg;
    }
  }
  return fallback;
}

export async function api<T>(path: string, opts: { method?: Method; body?: unknown; auth?: boolean; retry?: boolean } = {}): Promise<T> {
  const { method = 'GET', body, auth = true, retry = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = useAuth.getState().tokens?.access_token;
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 && auth && retry && (await refreshTokens())) {
    return api<T>(path, { ...opts, retry: false });
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const obj = data && typeof data === 'object' ? (data as { detail?: unknown; message?: unknown }) : null;
    const detail = obj && 'detail' in obj ? obj.detail : data;
    const message = obj && typeof obj.message === 'string' ? obj.message : messageFrom(detail, `Request failed (${res.status})`);
    throw new ApiError(res.status, message, detail);
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}
