import { supabaseAdmin } from '@/lib/supabase-server'
import { resolveDispute, updateReportStatus } from '../actions'

export const dynamic = 'force-dynamic'

export default async function ModerationPage() {
  const db = supabaseAdmin()
  const [reports, disputes, reviews] = await Promise.all([
    db.from('reports').select('*, profiles!reports_reporter_id_fkey(display_name)').order('created_at', { ascending: false }).limit(50),
    db.from('disputes').select('*, bookings(provider_profiles(display_name))').order('created_at', { ascending: false }).limit(50),
    db.from('reviews').select('id, status, rating, body, created_at').order('created_at', { ascending: false }).limit(30),
  ])

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-BW', { timeZone: 'Africa/Gaborone', dateStyle: 'medium', timeStyle: 'short' })

  return (
    <div>
      <h1>Moderation & safety</h1>
      <p className="muted">User reports, booking disputes, and review moderation. Every resolution is audit-logged.</p>

      <h2>User reports ({(reports.data ?? []).filter((r) => r.status === 'open' || r.status === 'investigating').length} open)</h2>
      {(reports.data ?? []).length === 0 ? (
        <div className="empty">No reports filed.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr><th>Filed</th><th>Reporter</th><th>Category</th><th>Description</th><th>Status</th><th>Resolve</th></tr>
            </thead>
            <tbody>
              {(reports.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.created_at)}</td>
                  <td>{(r as { profiles?: { display_name?: string } }).profiles?.display_name ?? r.reporter_id.slice(0, 8)}</td>
                  <td><span className={`pill ${r.status === 'open' ? 'bad' : r.status === 'investigating' ? 'warn' : 'ok'}`}>{r.category}</span></td>
                  <td className="small">{r.description}</td>
                  <td>{r.status}</td>
                  <td>
                    {r.status !== 'resolved' && r.status !== 'dismissed' ? (
                      <form action={updateReportStatus} className="row">
                        <input type="hidden" name="report_id" value={r.id} />
                        <select name="status" defaultValue={r.status} style={{ width: 'auto' }}>
                          <option value="open">open</option>
                          <option value="investigating">investigating</option>
                          <option value="resolved">resolved</option>
                          <option value="dismissed">dismissed</option>
                        </select>
                        <button className="btn small" type="submit">Save</button>
                      </form>
                    ) : (
                      <span className="muted small">{r.resolution_note ?? 'Closed'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Disputes ({(disputes.data ?? []).filter((d) => d.status === 'open').length} open)</h2>
      {(disputes.data ?? []).length === 0 ? (
        <div className="empty">No disputes opened.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Opened</th><th>Booking</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {(disputes.data ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{fmt(d.created_at)}</td>
                  <td className="muted small">{d.booking_id.slice(0, 8)}…</td>
                  <td className="small">{d.reason}</td>
                  <td><span className={`pill ${d.status === 'open' ? 'bad' : d.status === 'investigating' ? 'warn' : 'ok'}`}>{d.status}</span></td>
                  <td>
                    {d.status !== 'resolved' ? (
                      <form action={resolveDispute} className="row">
                        <input type="hidden" name="dispute_id" value={d.id} />
                        <input name="note" placeholder="Resolution note" style={{ width: 180 }} />
                        <button className="btn small" type="submit">Resolve</button>
                      </form>
                    ) : (
                      <span className="muted small">{d.resolution_note ?? 'Resolved'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Recent reviews</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Date</th><th>Rating</th><th>Text</th><th>Status</th></tr></thead>
          <tbody>
            {(reviews.data ?? []).length === 0 ? (
              <tr><td colSpan={4} className="empty">No reviews yet.</td></tr>
            ) : (
              (reviews.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.created_at)}</td>
                  <td>{'★'.repeat(r.rating)}</td>
                  <td className="small">{r.body ?? <span className="muted">—</span>}</td>
                  <td><span className={`pill ${r.status === 'published' ? 'ok' : 'warn'}`}>{r.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
