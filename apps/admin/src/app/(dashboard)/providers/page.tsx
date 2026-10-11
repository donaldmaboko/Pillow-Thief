import { supabaseAdmin } from '@/lib/supabase-server'
import { decideApplication, setProviderStatus } from '../actions'
import { formatMoney, money } from '@pillow-thief/shared'

export const dynamic = 'force-dynamic'

export default async function ProvidersPage() {
  const db = supabaseAdmin()
  const [applications, providers] = await Promise.all([
    db.from('provider_applications').select('*, profiles(display_name)').order('created_at', { ascending: true }),
    db.from('provider_profiles').select('*, profiles(display_name, created_at)').order('created_at', { ascending: false }),
  ])

  return (
    <div>
      <h1>Providers & verification</h1>
      <p className="muted">Review applications, verify identities, and manage provider status.</p>

      <h2>Pending applications ({(applications.data ?? []).filter((a) => a.status === 'pending').length})</h2>
      {(applications.data ?? []).length === 0 ? (
        <div className="empty">No applications yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Legal name</th>
                <th>DOB</th>
                <th>City</th>
                <th>Base price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(applications.data ?? []).map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.display_name}</strong>
                    <div className="muted small">{a.bio?.slice(0, 90)}…</div>
                    <div className="muted small">Boundaries: {a.boundaries?.slice(0, 90)}…</div>
                  </td>
                  <td>{a.legal_name}</td>
                  <td>{a.date_of_birth}</td>
                  <td>{a.city}</td>
                  <td>{formatMoney(money(a.base_price_60_minor, 'BWP'))}/60m</td>
                  <td>
                    <span className={`pill ${a.status === 'pending' ? 'warn' : a.status === 'verified' ? 'ok' : a.status === 'rejected' ? 'bad' : 'muted'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    {a.status === 'pending' ? (
                      <div className="row">
                        <form action={decideApplication}>
                          <input type="hidden" name="application_id" value={a.id} />
                          <input type="hidden" name="action" value="approve" />
                          <button className="btn small" type="submit">Approve</button>
                        </form>
                        <form action={decideApplication}>
                          <input type="hidden" name="application_id" value={a.id} />
                          <input type="hidden" name="action" value="reject" />
                          <button className="btn small danger" type="submit">Reject</button>
                        </form>
                        <form action={decideApplication}>
                          <input type="hidden" name="application_id" value={a.id} />
                          <input type="hidden" name="action" value="request_more_info" />
                          <button className="btn small secondary" type="submit">More info</button>
                        </form>
                      </div>
                    ) : (
                      <span className="muted small">
                        {a.review_note ? `Note: ${a.review_note}` : '—'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>All providers ({(providers.data ?? []).length})</h2>
      {(providers.data ?? []).length === 0 ? (
        <div className="empty">No provider profiles yet.</div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>City</th>
                <th>Verification</th>
                <th>Published</th>
                <th>Rating</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(providers.data ?? []).map((p) => (
                <tr key={p.provider_id}>
                  <td>
                    <strong>{(p as { profiles?: { display_name?: string } }).profiles?.display_name ?? p.provider_id}</strong>
                    <div className="muted small">{p.headline?.slice(0, 80)}</div>
                  </td>
                  <td>{p.city}</td>
                  <td>
                    <span className={`pill ${p.verification === 'verified' ? 'ok' : p.verification === 'suspended' ? 'bad' : 'warn'}`}>
                      {p.verification}
                    </span>
                  </td>
                  <td>{p.published ? 'Yes' : 'No'}</td>
                  <td>{p.avg_rating != null ? `${p.avg_rating} (${p.review_count})` : '—'}</td>
                  <td>
                    <div className="row">
                      {p.verification !== 'suspended' ? (
                        <form action={setProviderStatus}>
                          <input type="hidden" name="provider_id" value={p.provider_id} />
                          <input type="hidden" name="action" value="suspend" />
                          <button className="btn small danger" type="submit">Suspend</button>
                        </form>
                      ) : (
                        <form action={setProviderStatus}>
                          <input type="hidden" name="provider_id" value={p.provider_id} />
                          <input type="hidden" name="action" value="reinstate" />
                          <button className="btn small" type="submit">Reinstate</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
