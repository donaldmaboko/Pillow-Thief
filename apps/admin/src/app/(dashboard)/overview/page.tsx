import { supabaseAdmin } from '@/lib/supabase-server'
import { formatMoney, money } from '@pillow-thief/shared'

export const dynamic = 'force-dynamic'

export default async function OverviewPage() {
  const db = supabaseAdmin()

  // Every number below is a real aggregate from the database — never invented.
  const [clients, providers, pendingVerifications, activeBookings, completedBookings, cancelledBookings, gmv, revenue, refunds, openDisputes, openReports] =
    await Promise.all([
      db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client').is('deactivated_at', null),
      db.from('provider_profiles').select('provider_id', { count: 'exact', head: true }),
      db.from('provider_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('bookings').select('id', { count: 'exact', head: true }).in('status', ['pending_payment', 'pending_approval', 'confirmed', 'in_progress']),
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      db.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
      db.from('payments').select('amount_minor').eq('status', 'captured'),
      db.from('bookings').select('commission_minor').eq('status', 'completed'),
      db.from('refunds').select('amount_minor').in('status', ['succeeded', 'processing']),
      db.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      db.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ])

  const grossMinor = (gmv.data ?? []).reduce((s, p) => s + p.amount_minor, 0)
  const revenueMinor = (revenue.data ?? []).reduce((s, b) => s + b.commission_minor, 0)
  const refundMinor = (refunds.data ?? []).reduce((s, r) => s + r.amount_minor, 0)
  const bwp = (minor: number) => formatMoney(money(minor, 'BWP'))

  const stats = [
    { label: 'Total clients', value: String(clients.count ?? 0) },
    { label: 'Total providers', value: String(providers.count ?? 0) },
    { label: 'Pending verifications', value: String(pendingVerifications.count ?? 0), warn: (pendingVerifications.count ?? 0) > 0 },
    { label: 'Active bookings', value: String(activeBookings.count ?? 0) },
    { label: 'Completed bookings', value: String(completedBookings.count ?? 0) },
    { label: 'Cancelled bookings', value: String(cancelledBookings.count ?? 0) },
    { label: 'Gross booking value', value: bwp(grossMinor) },
    { label: 'Platform revenue', value: bwp(revenueMinor), success: true },
    { label: 'Refunds', value: bwp(refundMinor), danger: refundMinor > 0 },
    { label: 'Open disputes', value: String(openDisputes.count ?? 0), danger: (openDisputes.count ?? 0) > 0 },
    { label: 'Open safety reports', value: String(openReports.count ?? 0), danger: (openReports.count ?? 0) > 0 },
  ]

  return (
    <div>
      <h1>Overview</h1>
      <p className="muted">Live operational metrics for Pillow Thief · Gaborone (BWP)</p>
      <div className="grid cols-4" style={{ marginTop: 16 }}>
        {stats.map((s) => (
          <div key={s.label} className="card stat">
            <span className="label">{s.label}</span>
            <span className={`value ${s.danger ? 'danger' : s.success ? 'success' : ''}`}>{s.value}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 16 }}>
        Metrics are computed from live tables at render time. No figures are estimated or fabricated.
      </p>
    </div>
  )
}
