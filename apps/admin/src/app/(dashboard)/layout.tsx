import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/supabase-server'
import { LogoutButton } from './logout-button'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, admin } = await requireAdmin()
  if (!user) redirect('/login')
  if (!admin) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <h1>Access denied</h1>
        <p className="muted">This account does not have administrator privileges.</p>
        <LogoutButton />
      </div>
    )
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">Pillow Thief</div>
        <Link href="/overview">Overview</Link>
        <Link href="/providers">Providers & verification</Link>
        <Link href="/bookings">Bookings</Link>
        <Link href="/payments">Payments & payouts</Link>
        <Link href="/moderation">Moderation & safety</Link>
        <Link href="/settings">Platform settings</Link>
        <div className="spacer" style={{ flex: 1 }} />
        <div className="muted small" style={{ padding: '0 12px 8px', color: 'var(--beige)' }}>
          Signed in as admin
        </div>
        <LogoutButton sidebar />
      </aside>
      <main className="main">{children}</main>
    </div>
  )
}
