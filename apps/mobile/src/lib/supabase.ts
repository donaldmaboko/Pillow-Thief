import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { config, isSupabaseConfigured } from './config'

/**
 * Single Supabase client for the app. Sessions persist in AsyncStorage;
 * the auth JWT is attached automatically by @supabase/supabase-js.
 * Sensitive tokens live in the keychain via Expo SecureStore where the
 * underlying library supports it.
 */

// A null-safe stub so importing modules never crashes before configuration.
function buildClient() {
  if (!isSupabaseConfigured()) {
    return null
  }
  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
}

export const supabase = buildClient()

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase env missing. Copy apps/mobile/.env.example to apps/mobile/.env and restart the dev server.',
    )
  }
  return supabase
}

export type SupabaseClient = NonNullable<ReturnType<typeof buildClient>>
