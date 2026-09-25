/// <reference types="vite/client" />
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// Safe public configuration injected by Vite define or fallback
const defaultSupabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL || 'https://uoqefhebqkvlmycbimql.supabase.co')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/$/, '');

const defaultSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient = createClient(
  defaultSupabaseUrl,
  defaultSupabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);

/**
 * Helper to wrap any promise with a safety timeout.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs = 7000,
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes email address to match Supabase Auth accounts.
 * Attorneys seeded in Supabase Auth use the domain @crownledger.internal.
 */
export function normalizeAuthEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.endsWith('@crownledger.law')) {
    return trimmed.replace('@crownledger.law', '@crownledger.internal');
  }
  return trimmed;
}

/**
 * Signs into Supabase Auth with email and password.
 */
export async function signInToSupabase(
  email: string,
  password: string
): Promise<{ session: Session | null; error: string | null }> {
  try {
    const authEmail = normalizeAuthEmail(email);
    if (!password) {
      return { session: null, error: 'Password is required' };
    }
    const result = await withTimeout(
      supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      }),
      10000,
      'Authentication request timed out. Please check your network connection.'
    );

    if (result.error) {
      return { session: null, error: result.error.message };
    }

    return { session: result.data.session, error: null };
  } catch (err: any) {
    return { session: null, error: err?.message || 'Authentication failed' };
  }
}

/**
 * Signs out from Supabase Auth and purges the session.
 */
export async function signOutFromSupabase(): Promise<void> {
  try {
    await withTimeout(supabase.auth.signOut(), 4000, 'Sign-out timed out');
  } catch (err) {
    console.error('Sign-out error:', err);
  }
}

/**
 * Purges any active or stale Supabase session.
 */
export async function clearSupabaseSession(): Promise<void> {
  try {
    await withTimeout(supabase.auth.signOut(), 4000, 'Clear session timed out');
  } catch {
    // Ignore sign-out errors
  }
}

/**
 * Retrieves the current Supabase Auth session with a safety timeout.
 */
export async function getSupabaseSession(timeoutMs = 7000): Promise<Session | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      timeoutMs,
      'Supabase session check timed out.'
    );
    if (error || !data?.session) {
      return null;
    }
    return data.session;
  } catch (err) {
    console.warn('getSupabaseSession note:', err);
    return null;
  }
}

/**
 * Retrieves the current Supabase Auth access token.
 * Validates expiration and automatically refreshes expiring tokens with timeout.
 */
export async function getSupabaseAccessToken(timeoutMs = 7000): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      timeoutMs,
      'Supabase session token check timed out.'
    );
    if (error || !data?.session) {
      return null;
    }

    const session = data.session;
    const expiresAt = session.expires_at; // Unix epoch seconds
    const now = Math.floor(Date.now() / 1000);

    // If token has expired or is expiring within 30 seconds, attempt to refresh
    if (expiresAt && expiresAt <= now + 30) {
      try {
        const { data: refreshData, error: refreshError } = await withTimeout(
          supabase.auth.refreshSession(),
          timeoutMs,
          'Supabase session token refresh timed out.'
        );
        if (!refreshError && refreshData.session?.access_token) {
          return refreshData.session.access_token;
        }
      } catch (refreshErr) {
        console.warn('Supabase token refresh failed or timed out:', refreshErr);
      }
      // If refresh failed or session is invalid, purge and return null to trigger fresh sign-in
      await clearSupabaseSession();
      return null;
    }

    return session.access_token;
  } catch (err) {
    console.warn('getSupabaseAccessToken note:', err);
    return null;
  }
}
