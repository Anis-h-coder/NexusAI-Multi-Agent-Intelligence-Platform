/**
 * Resilient API client for NexusAI Platform
 * Protects against HTML error responses, unparsed doctype errors, and network timeouts.
 */

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
}

// The CSRF token lives in memory only (never localStorage) and is re-issued by /api/auth/me on every page load.
let csrfToken: string | null = null;
export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

const unauthorizedListeners = new Set<() => void>();
/** Registers a callback fired when any protected API call answers 401 (session expired / revoked). */
export function onUnauthorized(listener: () => void): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const result = await rawSafeFetchJson<T>(url, options);
  if (result.status === 401 && !url.startsWith('/api/auth/')) {
    unauthorizedListeners.forEach((fn) => fn());
  }
  return result;
}

async function rawSafeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const method = (options?.method || 'GET').toUpperCase();
    const headers = new Headers(options?.headers);
    if (csrfToken && method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      headers.set('X-CSRF-Token', csrfToken);
    }
    const res = await fetch(url, { ...options, headers, credentials: 'same-origin' });
    const contentType = res.headers.get('content-type') || '';
    
    // Check if the response is JSON
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: data?.error || data?.message || `Request failed with status ${res.status}`,
        };
      }
      return {
        ok: true,
        status: res.status,
        data,
      };
    }

    // If server returned non-JSON (like HTML during startup/error pages)
    const rawText = await res.text();
    const isHtml = rawText.trim().toLowerCase().startsWith('<!doctype') || rawText.includes('<html');
    
    if (isHtml) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Server returned an HTML document instead of JSON (Status ${res.status}). The service might still be initializing.`,
      };
    }

    // Try parsing text as JSON just in case content-type header was missing
    try {
      const parsed = JSON.parse(rawText);
      return {
        ok: res.ok,
        status: res.status,
        data: parsed,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: rawText.slice(0, 150) || `Request failed with status ${res.status}`,
      };
    }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || 'Network request failed',
    };
  }
}
