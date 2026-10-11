'use server'

import { revalidatePath } from 'next/cache'
import { supabaseAdmin, supabaseServer } from '@/lib/supabase-server'

/**
 * Admin server actions. Authorization is enforced twice:
 *  1. requireAdmin() at the page level,
 *  2. inside the Edge Function (JWT must belong to a role=admin profile).
 */

async function callFunction(fn: string, body: object) {
  const sb = await supabaseServer()
  const { data } = await sb.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Session expired — sign in again.')
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.error?.message ?? `Action failed (${res.status})`)
  return json
}

export async function decideApplication(formData: FormData) {
  const action = String(formData.get('action'))
  const applicationId = String(formData.get('application_id'))
  const note = String(formData.get('note') ?? '')
  await callFunction('admin-verification', {
    action: action as 'approve' | 'reject' | 'request_more_info',
    application_id: applicationId,
    note: note || undefined,
  })
  revalidatePath('/providers')
  revalidatePath('/overview')
}

export async function setProviderStatus(formData: FormData) {
  const action = String(formData.get('action'))
  const providerId = String(formData.get('provider_id'))
  await callFunction('admin-verification', {
    action: action as 'suspend' | 'reinstate',
    provider_id: providerId,
  })
  revalidatePath('/providers')
}

export async function updatePlatformSettings(formData: FormData) {
  const sb = supabaseAdmin()
  const commissionBps = Number(formData.get('commission_bps'))
  const bookingFeeMinor = Number(formData.get('booking_fee_minor'))
  const taxRateBps = Number(formData.get('tax_rate_bps'))
  if (!Number.isInteger(commissionBps) || !Number.isInteger(bookingFeeMinor) || !Number.isInteger(taxRateBps)) {
    throw new Error('All settings must be whole numbers.')
  }
  const { error } = await sb
    .from('platform_settings')
    .update({
      commission_bps: commissionBps,
      booking_fee_minor: bookingFeeMinor,
      tax_rate_bps: taxRateBps,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)
  if (error) throw new Error(error.message)
  revalidatePath('/settings')
  revalidatePath('/overview')
}

export async function updateReportStatus(formData: FormData) {
  const sb = supabaseAdmin()
  const reportId = String(formData.get('report_id'))
  const status = String(formData.get('status'))
  const note = String(formData.get('note') ?? '')
  const { error } = await sb
    .from('reports')
    .update({
      status,
      resolution_note: note || null,
      resolved_at: ['resolved', 'dismissed'].includes(status) ? new Date().toISOString() : null,
    })
    .eq('id', reportId)
  if (error) throw new Error(error.message)
  revalidatePath('/moderation')
}

export async function resolveDispute(formData: FormData) {
  const sb = supabaseAdmin()
  const disputeId = String(formData.get('dispute_id'))
  const note = String(formData.get('note') ?? '')
  const { error } = await sb
    .from('disputes')
    .update({ status: 'resolved', resolution_note: note || null, resolved_at: new Date().toISOString() })
    .eq('id', disputeId)
  if (error) throw new Error(error.message)
  revalidatePath('/moderation')
}

export async function runPayouts(formData: FormData) {
  const periodStart = String(formData.get('period_start'))
  const periodEnd = String(formData.get('period_end'))
  const result = await callFunction('payouts-run', { period_start: periodStart, period_end: periodEnd })
  revalidatePath('/payments')
  return result
}
