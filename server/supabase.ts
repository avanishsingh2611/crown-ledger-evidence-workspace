import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config';

// Server-side admin client using service_role key
// CRITICAL: NEVER EXPOSE THIS KEY TO THE CLIENT
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// Factory for requests authenticated with user's own JWT or anon client
export function createSupabaseUserClient(accessToken?: string): SupabaseClient {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  return createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers,
    },
  });
}
