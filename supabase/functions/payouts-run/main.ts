// ============================================================================
// payouts-run — admin-triggered payout aggregation for completed bookings.
//
// POST { period_start: 'YYYY-MM-DD', period_end: 'YYYY-MM-DD' }  (admin only)
//
// Aggregates completed bookings (minus commission and refunds) into
// provider_payouts rows. Payout rows are records of what is owed; the actual
// transfer happens through the configured payout provider (manual in
// Botswana until a marketplace-capable gateway is confirmed — see
// docs/PAYMENTS.md). Nothing here fabricates balances: every number comes
// from payments/refunds/bookings.
// ============================================================================

import { z } from 'zod'
import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { supabaseAdmin, supabaseUser } from '../_shared/supabase.ts'

const bodySchema = z.object({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const userClient = supabaseUser(req)
    const { data: authData } = await userClient.auth.getUser()
    const adminId = authData?.user?.id
    if (!adminId) return error('auth_required', 'Sign in required', 401)

    const db = supabaseAdmin()
    const { data: adminProfile } = await db.from('profiles').select('role').eq('id', adminId).maybeSingle()
    if (adminProfile?.role !== 'admin') return error('forbidden', 'Admin role required', 403)

    const { data: raw } = await readJsonBody(req)
    const body = bodySchema.parse(raw)

    // Completed bookings in the window (bookings completed_at inside window).
    const { data: bookings, error: bErr } = await db
      .from('bookings')
      .select('provider_id, total_minor, commission_minor, currency')
      .eq('status', 'completed')
      .gte('completed_at', `${body.period_start}T00:00:00Z`)
      .lte('completed_at', `${body.period_end}T23:59:59Z`)
    if (bErr) return error('external_service', bErr.message, 500)

    const byProvider = new Map<string, { gross: number; commission: number; currency: string }>()
    for (const b of bookings ?? []) {
      const agg = byProvider.get(b.provider_id) ?? { gross: 0, commission: 0, currency: b.currency }
      agg.gross += b.total_minor
      agg.commission += b.commission_minor
      byProvider.set(b.provider_id, agg)
    }

    const created: string[] = []
    for (const [providerId, agg] of byProvider) {
      // Refunds on the provider's bookings in the same window.
      const { data: refunds } = await db
        .from('refunds')
        .select('amount_minor')
        .eq('status', 'succeeded')
        .gte('created_at', `${body.period_start}T00:00:00Z`)
        .lte('created_at', `${body.period_end}T23:59:59Z`)
        .then((r) => r)
      // Refunds are joined to bookings via booking_id; filter client-side for clarity.
      const { data: providerRefunds } = await db
        .from('refunds')
        .select('amount_minor, bookings!inner(provider_id)')
        .eq('status', 'succeeded')
        .gte('created_at', `${body.period_start}T00:00:00Z`)
        .lte('created_at', `${body.period_end}T23:59:59Z`)
        .eq('bookings.provider_id', providerId)
      const refunded = (providerRefunds ?? []).reduce((s, r) => s + r.amount_minor, 0)
      void refunds

      // Skip providers already paid out for this window (idempotent).
      const { data: existing } = await db
        .from('provider_payouts')
        .select('id')
        .eq('provider_id', providerId)
        .eq('period_start', body.period_start)
        .eq('period_end', body.period_end)
        .maybeSingle()
      if (existing) continue

      const net = agg.gross - agg.commission - refunded
      const { data: inserted, error: insErr } = await db
        .from('provider_payouts')
        .insert({
          provider_id: providerId,
          period_start: body.period_start,
          period_end: body.period_end,
          gross_minor: agg.gross,
          commission_minor: agg.commission,
          refunds_minor: refunded,
          adjustments_minor: 0,
          net_minor: net,
          currency: agg.currency,
          status: 'pending',
        })
        .select('id')
        .single()
      if (insErr) return error('external_service', insErr.message, 500)
      created.push(inserted.id)
    }

    return json({ payouts_created: created.length, providers: byProvider.size })
  } catch (err) {
    if (err instanceof z.ZodError) return error('validation', err.errors[0]?.message ?? 'Invalid input', 422)
    console.error(err)
    return error('internal', 'Payout run failed', 500)
  }
})
