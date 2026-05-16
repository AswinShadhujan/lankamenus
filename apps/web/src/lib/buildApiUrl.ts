import { getApiBaseUrl } from '@/lib/api';

/** Build absolute API URL with cache-busting `_ts` (client-side). */
export function buildApiUrl(path: string, params?: Record<string, string | number>): string {
  const base = (getApiBaseUrl() || (typeof window !== 'undefined' ? window.location.origin : '')).replace(
    /\/$/,
    '',
  );
  const url = new URL(path, `${base}/`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (typeof v === 'number' && !Number.isFinite(v)) continue;
      url.searchParams.set(k, String(v));
    }
  }
  url.searchParams.set('_ts', String(Date.now()));
  return url.toString();
}
