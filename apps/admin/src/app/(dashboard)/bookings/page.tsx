import { supabaseAdmin } from '@/lib/supabase-server'
import { formatMoney, money } from '@pillow-thief/shared'

export const dynamic = 'force-dynamic'

const STATUS_PILL: Record<string, string> = {
  confirmed: 'ok',
  completed: 'ok',
  in_progress: 'warn',
  pending_payment: 'warn',
  pending_approval: 'warn',
  disputed: 'bad',
  cancelled: 'bad',
  declined: 'bad',
  expired: 'muted',
  draft: 'muted',
}

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const params = await searchParams
  const db = supabaseAdmin()
  let query = db
    .from('bookings')
    .select('*, provider_profiles(display_name), profiles!bookings_client_id_fkey(display_name), provider_services(title)')
    .order('starts_at', { ascending: false })
    .limit(100)
  if (params.status) query = query.eq('status', params.status)
  const { data: bookings } = await query

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-BW', { timeZone: 'Africa/Gaborone', dateStyle: 'medium', timeStyle: 'short' })

  const statuses = ['all', 'pending_payment', 'pending_approval', 'confirmed', 'in_progress', 'completed', 'cancelled', 'declined', 'disputed']

  return (
    <div>
      <h1>Bookings</h1>
      <p className="muted">Every booking with status, participants and exact amounts (BWP).</p>

      <div className="row" style={{ margin: '12px 0 16px' }}>
        {statuses.map((s) => (
          <a key={s} href={s === 'all' ? '/bookings' : `/bookings?status=${s}`} className={`pill ${params.status === s || (s === 'all' && !params.status) ? 'ok' : 'muted'}`}>
            {s}
          </a>
        ))}
      </div>

      {(bookings ?? []).length === 0 ? (
        <div className="empty">No bookings match this filter.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>When (CAT)</th>
                <th>Client</th>
                <th>Provider</th>
                <th>Service</th>
                <th>Status</th>
                <th>Total</th>
                <th>Commission</th>
              </tr>
            </thead>
            <tbody>
              {(bookings ?? []).map((b) => (
                <tr key={b.id}>
                  <td>
                    {fmt(b.starts_at)}
                    <div className="muted small">{b.duration_min} min · {b.meeting_arrangement.replace('_', ' ')}</div>
                  </td>
                  <td>{(b as { profiles?: { display_name?: string } }).profiles?.display_name ?? b.client_id.slice(0, 8)}</td>
                  <td>{(b as { provider_profiles?: { display_name?: string } }).provider_profiles?.display_name ?? b.provider_id.slice(0, 8)}</td>
                  <td>{(b as { provider_services?: { title?: string } }).provider_services?.title ?? b.service_id.slice(0, 8)}</td>
                  <td><span className={`pill ${STATUS_PILL[b.status] ?? 'muted'}`}>{b.status}</span></td>
                  <td>{formatMoney(money(b.total_minor, b.currency))}</td>
                  <td className="muted">{formatMoney(money(b.commission_minor, b.currency))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
