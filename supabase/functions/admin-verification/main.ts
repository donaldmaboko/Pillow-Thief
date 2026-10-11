// ============================================================================
// admin-verification — admin workflow for provider applications.
//
// POST {
//   action: 'approve' | 'reject' | 'request_more_info' | 'suspend' | 'reinstate',
//   application_id?: string, provider_id?: string, note?: string
// }
//
// Authorization: the caller's JWT must belong to a profile with role=admin.
// Approving an application provisions the provider_profiles row, flips the
// user's role to 'provider', and marks them published. Every action is
// audit-logged (triggers on provider_applications + service_role writes).
// ============================================================================

import { z } from 'zod'
import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { supabaseAdmin, supabaseUser } from '../_shared/supabase.ts'

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'request_more_info', 'suspend', 'reinstate']),
  application_id: z.string().uuid().optional(),
  provider_id: z.string().uuid().optional(),
  note: z.string().max(1000).optional(),
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

    // ---- Suspend / reinstate operate on an existing provider. ----
    if (body.action === 'suspend' || body.action === 'reinstate') {
      if (!body.provider_id) return error('validation', 'provider_id required', 422)
      const verification = body.action === 'suspend' ? 'suspended' : 'verified'
      const published = body.action !== 'suspend'
      const { error: updErr } = await db
        .from('provider_profiles')
        .update({ verification, published })
        .eq('provider_id', body.provider_id)
      if (updErr) return error('external_service', updErr.message, 500)
      await db.from('audit_logs').insert({
        actor_id: adminId,
        actor_role: 'admin',
        action: `provider.${body.action}`,
        table_name: 'provider_profiles',
        record_id: body.provider_id,
        after_data: { verification, published, note: body.note ?? null },
      })
      return json({ ok: true })
    }

    // ---- Application decisions. ----
    if (!body.application_id) return error('validation', 'application_id required', 422)
    const { data: application } = await db
      .from('provider_applications')
      .select('*')
      .eq('id', body.application_id)
      .maybeSingle()
    if (!application) return error('not_found', 'Application not found', 404)

    if (body.action === 'request_more_info') {
      const { error: updErr } = await db
        .from('provider_applications')
        .update({ status: 'pending', review_note: body.note ?? null, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq('id', application.id)
      if (updErr) return error('external_service', updErr.message, 500)
      await notify(db, application.user_id, 'verification.update', 'Verification update needed', body.note ?? 'Please review your application.')
      return json({ ok: true })
    }

    if (body.action === 'reject') {
      const { error: updErr } = await db
        .from('provider_applications')
        .update({ status: 'rejected', review_note: body.note ?? null, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
        .eq('id', application.id)
      if (updErr) return error('external_service', updErr.message, 500)
      await notify(db, application.user_id, 'verification.rejected', 'Provider application update', 'Unfortunately your application was not approved this time.')
      return json({ ok: true })
    }

    // ---- APPROVE ----
    // Age sanity check (defense in depth; the CHECK constraint also enforces 18+).
    const dob = new Date(application.date_of_birth)
    const ageMs = Date.now() - dob.getTime()
    if (ageMs < 18 * 365.25 * 24 * 3600 * 1000) {
      return error('validation', 'Applicant is under 18; cannot approve', 422)
    }

    // 1. Promote the user's role.
    const { error: roleErr } = await db.from('profiles').update({ role: 'provider' }).eq('id', application.user_id)
    if (roleErr) return error('external_service', roleErr.message, 500)

    // 2. Provision the professional profile (unpublished until they finish setup).
    const { error: ppErr } = await db.from('provider_profiles').upsert({
      provider_id: application.user_id,
      headline: application.bio.slice(0, 120),
      bio: application.bio,
      languages: application.languages,
      city: application.city,
      neighbourhood: application.neighbourhood,
      accepts: application.accepts,
      verification: 'verified',
      published: false,
    })
    if (ppErr) return error('external_service', ppErr.message, 500)

    // 3. Seed a default service priced from the application.
    const { data: existingServices } = await db
      .from('provider_services')
      .select('id')
      .eq('provider_id', application.user_id)
      .limit(1)
    if (!existingServices || existingServices.length === 0) {
      await db.from('provider_services').insert({
        provider_id: application.user_id,
        title: 'Comfort Cuddle Session',
        description: application.boundaries.slice(0, 600),
        price_60_minor: application.base_price_60_minor,
      })
    }

    // 4. Close the application.
    const { error: appErr } = await db
      .from('provider_applications')
      .update({ status: 'verified', review_note: body.note ?? null, reviewed_by: adminId, reviewed_at: new Date().toISOString() })
      .eq('id', application.id)
    if (appErr) return error('external_service', appErr.message, 500)

    await notify(db, application.user_id, 'verification.approved', 'You’re verified! 🎉',
      'Finish setting up your services, availability and service area, then publish your profile.')

    return json({ ok: true, provider_id: application.user_id })
  } catch (err) {
    if (err instanceof z.ZodError) return error('validation', err.errors[0]?.message ?? 'Invalid input', 422)
    console.error(err)
    return error('internal', 'Verification action failed', 500)
  }
})

async function notify(db: ReturnType<typeof supabaseAdmin>, userId: string, kind: string, title: string, body: string) {
  await db.rpc('notify_user', {
    p_user: userId,
    p_kind: kind,
    p_title: title,
    p_body: body,
  })
}
