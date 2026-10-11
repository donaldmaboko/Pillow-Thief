'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-client'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const sb = supabaseBrowser()
      const { data, error: err } = await sb.auth.signInWithPassword({ email, password })
      if (err) throw err
      // Enforce admin role client-side as a courtesy; RLS + server checks are authoritative.
      const { data: profile } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      if (profile?.role !== 'admin') {
        await sb.auth.signOut()
        throw new Error('This account is not authorised for the admin dashboard.')
      }
      router.push('/overview')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error ? <div className="error-banner">{error}</div> : null}
      <label htmlFor="email">Email</label>
      <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      <label htmlFor="password">Password</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      <button className="btn" style={{ marginTop: 18, width: '100%', justifyContent: 'center' }} disabled={loading} type="submit">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
