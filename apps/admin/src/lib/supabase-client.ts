import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser Supabase client (login form, sign-out button).
 * Uses the anon key only and relies on RLS for everything it touches.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
