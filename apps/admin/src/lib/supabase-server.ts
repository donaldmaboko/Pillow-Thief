import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: CookieOptions }
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * Server-only Supabase helpers.
 *
 * - supabaseServer(): reads flow through RLS as the signed-in admin.
 * - supabaseAdmin(): service-role client that bypasses RLS. SERVER ONLY —
 *   never import this module from a 'use client' component.
 */

export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          try {
            toSet.forEach(({ name, value, options }: CookieToSet) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component render; middleware refreshes sessions.
          }
        },
      },
    },
  )
}

export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (see .env.example)')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  })
}

/** Verify the current session belongs to an admin profile. */
export async function requireAdmin() {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getUser()
  if (!data.user) return { user: null as null, admin: false, profile: null }
  const { data: profile } = await sb
    .from('profiles')
    .select('id, role, display_name')
    .eq('id', data.user.id)
    .maybeSingle()
  return { user: data.user, admin: profile?.role === 'admin', profile }
}
