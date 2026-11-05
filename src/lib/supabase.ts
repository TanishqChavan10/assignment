import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Supabase client using the SECRET service-role key.
 * NEVER import this in client components or expose to the browser.
 *
 * Usage in API route handlers:
 *   import { supabase } from '@/lib/supabase';
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SECRET_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY env vars. ' +
    'Copy .env.example → .env.local and fill in your Supabase project credentials.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

