import { supabaseAdmin } from '@/lib/supabase-server'
import { formatMoney, money } from '@pillow-thief/shared'
import { runPayouts } from '../actions'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const db = supabaseAdmin()
  const [payments, refunds, payouts] = await Promise.all([
    db.from('payments').select('*, bookings(provider_profiles(display_name))').order('created_at', { ascending: false }).limit(80),
    db.from('refunds').select('*').order('created_at', { ascending: false }).limit(40),
    db.from('provider_payouts').select('*, profiles(display_name)').order('period_end', { ascending: false }).limit(40),
  ])

  const fmt = (iso: string) => new Date(iso).toLocaleString('en-BW', { timeZone: 'Africa/Gaborone', dateStyle: 'medium', timeStyle: 'short' })
  const bwp = (minor: number, cur = 'BWP') => formatMoney(money(minor, cur))

  return (
    <div>
      <h1>Payments & payouts</h1>
      <p className="muted">Transaction ledger, refunds, and provider payout records. Amounts are exact minor-unit totals.</p>

      <h2>Transactions</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Created</th>
              <th>Gateway</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Intent</th>
            </tr>
          </thead>
          <tbody>
            {(payments.data ?? []).length === 0 ? (
              <tr><td colSpan={5} className="empty">No payments recorded.</td></tr>
            ) : (
              (payments.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{fmt(p.created_at)}</td>
                  <td>{p.gateway}</td>
                  <td><span className={`pill ${p.status === 'captured' ? 'ok' : p.status === 'failed' || p.status === 'refunded' ? 'bad' : 'warn'}`}>{p.status}</span></td>
                  <td>{bwp(p.amount_minor, p.currency)}</td>
                  <td className="muted small">{p.gateway_intent_id ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2>Refunds</h2>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Created</th><th>Status</th><th>Amount</th><th>Reason</th></tr></thead>
          <tbody>
            {(refunds.data ?? []).length === 0 ? (
              <tr><td colSpan={4} className="empty">No refunds recorded.</td></tr>
            ) : (
              (refunds.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{fmt(r.created_at)}</td>
                  <td><span className={`pill ${r.status === 'succeeded' ? 'ok' : r.status === 'failed' ? 'bad' : 'warn'}`}>{r.status}</span></td>
                  <td>{bwp(r.amount_minor, r.currency)}</td>
                  <td className="muted small">{r.reason}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2>Payouts</h2>
      <form action={runPayouts} className="card row" style={{ marginBottom: 12 }}>
        <label style={{ margin: 0 }}>
          From <input type="date" name="period_start" required style={{ marginTop: 4 }} />
        </label>
        <label style={{ margin: 0 }}>
          To <input type="date" name="period_end" required style={{ marginTop: 4 }} />
        </label>
        <button className="btn" type="submit">Generate payouts for period</button>
      </form>
      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Period</th><th>Provider</th><th>Gross</th><th>Commission</th><th>Refunds</th><th>Net</th><th>Status</th></tr></thead>
          <tbody>
            {(payouts.data ?? []).length === 0 ? (
              <tr><td colSpan={7} className="empty">No payouts generated yet.</td></tr>
            ) : (
              (payouts.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.period_start} → {p.period_end}</td>
                  <td>{(p as { profiles?: { display_name?: string } }).profiles?.display_name ?? p.provider_id.slice(0, 8)}</td>
                  <td>{bwp(p.gross_minor)}</td>
                  <td className="muted">−{bwp(p.commission_minor)}</td>
                  <td className="muted">−{bwp(p.refunds_minor)}</td>
                  <td><strong>{bwp(p.net_minor)}</strong></td>
                  <td><span className={`pill ${p.status === 'paid' ? 'ok' : p.status === 'failed' ? 'bad' : 'warn'}`}>{p.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
