import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SERVICE ROLE key.
 * Only ever import this in API routes / server components — never
 * in client-side code. This bypasses RLS, which is exactly what you
 * want for a shared cache table but means you must be deliberate
 * about what you query/write here.
 */
export function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
  });
}