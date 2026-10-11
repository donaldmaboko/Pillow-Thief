// ============================================================================
// account-delete — GDPR/DPO-style account deletion workflow.
//
// POST { confirm: true }
//
// Soft-deletes immediately (deactivated_at, removal from discovery, blocking
// of login) and queues hard deletion of the auth user. Financial and safety
// records are retained for the legally required period with personal fields
// minimised, as documented in docs/legal/privacy-policy.md.
// ============================================================================

import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { requireUser, supabaseAdmin } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const userId = await requireUser(req)
    const { data } = await readJsonBody(req)
    if ((data as { confirm?: boolean }).confirm !== true) {
      return error('validation', 'confirm: true is required to delete your account', 422)
    }
    const db = supabaseAdmin()

    // 1. Deactivate the profile (removes them from discovery via the view).
    await db.from('profiles').update({ deactivated_at: new Date().toISOString() }).eq('id', userId)

    // 2. Unpublish any provider profile.
    await db.from('provider_profiles').update({ published: false }).eq('provider_id', userId)

    // 3. Cancel future bookings where they are a participant.
    const { data: future } = await db
      .from('bookings')
      .select('id')
      .or(`client_id.eq.${userId},provider_id.eq.${userId}`)
      .in('status', ['draft', 'pending_payment', 'pending_approval', 'confirmed'])
      .gt('starts_at', new Date().toISOString())
    for (const b of future ?? []) {
      await db.from('bookings')
        .update({ status: 'cancelled', cancellation_reason: 'account_deleted' })
        .eq('id', b.id)
    }

    // 4. Clear personal push token + identifying profile fields.
    await db.from('profiles').update({
      expo_push_token: null,
      display_name: 'Deleted user',
      avatar_url: null,
    }).eq('id', userId)

    // 5. Delete the auth user (hard). Done last so earlier steps can still
    //    reference the user. Failures here are surfaced — nothing is claimed
    //    deleted until this succeeds.
    const { error: delErr } = await db.auth.admin.deleteUser(userId)
    if (delErr) return error('external_service', `Account deactivation staged but auth deletion failed: ${delErr.message}`, 500)

    return json({ deleted: true, note: 'Financial and safety records are retained per the retention schedule in the Privacy Policy.' })
  } catch (err) {
    if (err instanceof Error && err.message === 'auth_required') return error('auth_required', 'Sign in required', 401)
    console.error(err)
    return error('internal', 'Account deletion failed', 500)
  }
})
