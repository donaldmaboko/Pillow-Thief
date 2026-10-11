import { supabaseAdmin } from '@/lib/supabase-server'
import { updatePlatformSettings } from '../actions'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const db = supabaseAdmin()
  const { data: settings } = await db.from('platform_settings').select('*').eq('id', true).single()

  return (
    <div>
      <h1>Platform settings</h1>
      <p className="muted">Commission, fees and tax. Changes apply to new bookings immediately and are audit-logged.</p>

      <form action={updatePlatformSettings} className="card" style={{ maxWidth: 520 }}>
        <label htmlFor="commission_bps">Platform commission (basis points)</label>
        <input id="commission_bps" name="commission_bps" type="number" min={0} max={9000} defaultValue={settings?.commission_bps ?? 1500} required />
        <p className="muted small">1500 = 15%. Applied to completed bookings (gross minus tax).</p>

        <label htmlFor="booking_fee_minor">Booking fee (thebe)</label>
        <input id="booking_fee_minor" name="booking_fee_minor" type="number" min={0} defaultValue={settings?.booking_fee_minor ?? 2000} required />
        <p className="muted small">2000 thebe = P20.00 flat per booking. Set 0 to disable.</p>

        <label htmlFor="tax_rate_bps">Tax rate (basis points)</label>
        <input id="tax_rate_bps" name="tax_rate_bps" type="number" min={0} max={9000} defaultValue={settings?.tax_rate_bps ?? 1400} required />
        <p className="muted small">1400 = 14% (Botswana VAT). Confirm applicable rates with your tax advisor.</p>

        <button className="btn" type="submit" style={{ marginTop: 16 }}>Save settings</button>
      </form>

      <h2>Current values</h2>
      <div className="grid cols-3">
        <div className="card stat"><span className="label">Commission</span><span className="value">{(settings?.commission_bps ?? 0) / 100}%</span></div>
        <div className="card stat"><span className="label">Booking fee</span><span className="value">P{((settings?.booking_fee_minor ?? 0) / 100).toFixed(2)}</span></div>
        <div className="card stat"><span className="label">Tax</span><span className="value">{(settings?.tax_rate_bps ?? 0) / 100}%</span></div>
      </div>
    </div>
  )
}
