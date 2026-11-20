import { safeFetchJson, setCsrfToken } from './apiClient';
import type { UserSession } from '../types';

export interface SessionInfo {
  user: UserSession;
  geminiConfigured: boolean;
}

interface AuthPayload {
  user: UserSession;
  csrfToken: string;
  geminiConfigured?: boolean;
}

function accept(data: AuthPayload): SessionInfo {
  setCsrfToken(data.csrfToken);
  return { user: data.user, geminiConfigured: Boolean(data.geminiConfigured) };
}

/** Restores an existing cookie session (also re-issues the in-memory CSRF token). Returns null when signed out. */
export async function fetchSession(): Promise<SessionInfo | null> {
  const res = await safeFetchJson<AuthPayload>('/api/auth/me');
  return res.ok && res.data ? accept(res.data) : null;
}

export async function signIn(email: string, password: string): Promise<{ session?: SessionInfo; error?: string }> {
  const res = await safeFetchJson<AuthPayload>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.ok && res.data ? { session: accept(res.data) } : { error: res.error || 'Sign in failed' };
}

export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<{ session?: SessionInfo; error?: string }> {
  const res = await safeFetchJson<AuthPayload>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  return res.ok && res.data ? { session: accept(res.data) } : { error: res.error || 'Registration failed' };
}

export async function signOut(): Promise<void> {
  await safeFetchJson('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  setCsrfToken(null);
}
