// Supabase service-role client for Edge Functions.
// The service role bypasses RLS — use it carefully and only inside functions.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  cached = createClient(url, key, { auth: { persistSession: false } })
  return cached
}

/** Build a user-scoped client from the incoming Authorization header. */
export function supabaseUser(req: Request): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(url, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : {} },
    auth: { persistSession: false },
  })
}

export async function requireUser(req: Request): Promise<string> {
  const client = supabaseUser(req)
  const { data, error: err } = await client.auth.getUser()
  if (err || !data.user) throw new Error('auth_required')
  return data.user.id
}
