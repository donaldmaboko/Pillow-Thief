'use client'

import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-client'

export function LogoutButton({ sidebar = false }: { sidebar?: boolean }) {
  const router = useRouter()
  const logout = async () => {
    const sb = supabaseBrowser()
    await sb.auth.signOut()
    router.push('/login')
    router.refresh()
  }
  return (
    <button
      className="btn secondary"
      style={sidebar ? { background: 'transparent', color: 'var(--beige)', borderColor: 'var(--beige)', margin: '0 8px' } : {}}
      onClick={logout}
      type="button"
    >
      Sign out
    </button>
  )
}
