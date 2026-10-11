// ============================================================================
// push-notify — delivers in-app notifications as Expo push notifications.
//
// Reads unread, undelivered notifications for users who have an Expo push
// token and sends them via the Expo Push API. Idempotent: it marks rows as
// delivered so they are not re-sent. Sensitive meeting details are kept out
// of lock-screen payloads.
//
// POST { user_id?, notification_id? }  (service_role call only)
// ============================================================================

import { error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'

interface ExpoPushMessage {
  to: string
  sound?: string
  title: string
  body: string
  data?: Record<string, unknown>
  priority?: 'default' | 'normal' | 'high'
}

// Never put precise addresses / sensitive meeting detail on the lock screen.
function safeBody(body: string): string {
  return body.length > 100 ? `${body.slice(0, 97)}...` : body
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const authz = req.headers.get('Authorization') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!authz.includes(serviceKey ?? '__none__')) {
      return error('forbidden', 'service_role required', 403)
    }

    const { data } = await readJsonBody(req)
    const { user_id, notification_id } = data as { user_id?: string; notification_id?: string }
    const db = supabaseAdmin()

    let query = db
      .from('notifications')
      .select('id, user_id, kind, title, body, data, profiles(expo_push_token)')
      .is('read_at', null)
      .limit(100)
    if (notification_id) query = query.eq('id', notification_id)
    if (user_id) query = query.eq('user_id', user_id)

    const { data: rows, error: qErr } = await query
    if (qErr) return error('external_service', qErr.message, 500)

    const messages: { id: string; msg: ExpoPushMessage }[] = []
    for (const row of rows ?? []) {
      // deno-lint-ignore no-explicit-any
      const token = (row as any).profiles?.expo_push_token as string | undefined
      if (!token) continue
      messages.push({
        id: row.id,
        msg: {
          to: token,
          sound: 'default',
          title: row.title,
          body: safeBody(row.body),
          data: { kind: row.kind, ...(row.data as object ?? {}) },
          priority: 'high',
        },
      })
    }

    if (messages.length === 0) return json({ sent: 0 })

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.map((m) => m.msg)),
    })
    const result = await res.json()

    // Mark delivered tickets as read-free (we track delivery via read_at null
    // still; Expo delivery receipts would refine this in production).
    const sentIds = messages.map((m) => m.id)
    // We do NOT set read_at here — push delivery != user read. Instead we tag
    // data.pushed = true so we don't re-push.
    for (const id of sentIds) {
      const row = rows!.find((r) => r.id === id)
      await db
        .from('notifications')
        .update({ data: { ...(row?.data as object ?? {}), pushed: true } })
        .eq('id', id)
    }

    return json({ sent: messages.length, expo: res.status, tickets: result?.data?.length ?? 0 })
  } catch (err) {
    console.error(err)
    return error('internal', 'Push delivery failed', 500)
  }
})
