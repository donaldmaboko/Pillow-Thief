/**
 * Environment configuration. All values are EXPO_PUBLIC_* so they are
 * safe for the client: only the anon key ever ships in the app. Privileged
 * operations run in Edge Functions with the service role key, server-side.
 */

export const APP_TIMEZONE = 'Africa/Gaborone'
export const APP_CURRENCY = 'BWP'
export const APP_COUNTRY = 'BW'

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  sandboxMode: process.env.EXPO_PUBLIC_SANDBOX_MODE === 'true',
}

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseAnonKey)
}

/** True when Google Maps native keys are present (checked at runtime via expo-constants extra). */
export function assertSupabaseConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Copy apps/mobile/.env.example to .env and set EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (see docs/SETUP.md).',
    )
  }
}
