// ============================================================================
// booking-create — creates a booking + payment intent.
//
// Flow:
//   1. Authenticate the caller; they must be the client of the booking.
//   2. Re-quote everything server-side (never trust client prices).
//   3. create_booking RPC inserts the booking transactionally (double-booking
//      guard: exclusion constraint + slot re-check inside the transaction).
//   4. A payment intent is created; the booking stays `pending_payment`
//      until the webhook captures it.
// ============================================================================

import { z } from 'zod'
import { corsHeaders, error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { requireUser, supabaseAdmin } from '../_shared/supabase.ts'
import { getGateway } from '../_shared/payments.ts'
import { resolvePlaceId, routeEstimate } from '../_shared/google.ts'

const bodySchema = z.object({
  provider_id: z.string().uuid(),
  service_id: z.string().uuid(),
  duration_min: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  starts_at: z.string().datetime(),
  meeting_arrangement: z.enum(['provider_travels', 'client_visits', 'public_meeting']),
  client_place_id: z.string().max(200).optional(),
  client_lat: z.number().min(-90).max(90).optional(),
  client_lng: z.number().min(-180).max(180).optional(),
  client_address_label: z.string().max(160).optional(),
  service_location_id: z.string().uuid().optional(),
  promo_code: z.string().max(32).optional(),
  notes: z.string().max(500).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const userId = await requireUser(req)
    const { data: raw } = await readJsonBody(req)
    const body = bodySchema.parse(raw)
    const db = supabaseAdmin()

    // ---- Re-quote (identical rules to booking-quote; kept inline so the
    // ---- create path can never be bypassed by skipping the quote call).
    const { data: provider } = await db
      .from('provider_discovery')
      .select('*')
      .eq('provider_id', body.provider_id)
      .maybeSingle()
    if (!provider) return error('provider_not_approved', 'Provider not found or not published', 404)
    if (!provider.accepts.includes(body.meeting_arrangement)) {
      return error('meeting_location_invalid', 'Provider does not offer this meeting arrangement', 409)
    }

    const { data: service } = await db
      .from('provider_services')
      .select('*')
      .eq('id', body.service_id)
      .eq('provider_id', body.provider_id)
      .eq('active', true)
      .maybeSingle()
    if (!service) return error('service_not_found', 'Service not found', 404)

    const priceByDuration: Record<number, number | null> = {
      30: service.price_30_minor,
      60: service.price_60_minor,
      90: service.price_90_minor,
      120: service.price_120_minor,
    }
    const sessionPrice = priceByDuration[body.duration_min]
    if (sessionPrice == null) return error('duration_not_offered', 'Duration not offered', 409)

    // Travel fee (server-side) and location payload for booking_locations.
    let travelFee = 0
    let location: Record<string, unknown> | null = null

    if (body.meeting_arrangement === 'provider_travels') {
      let clientLat = body.client_lat
      let clientLng = body.client_lng
      let clientLabel = body.client_address_label
      if (body.client_place_id) {
        const resolved = await resolvePlaceId(body.client_place_id)
        if (resolved) {
          clientLat = resolved.lat
          clientLng = resolved.lng
          clientLabel = clientLabel ?? resolved.label
        }
      }
      if (clientLat == null || clientLng == null) {
        return error('meeting_location_invalid', 'A valid client location is required for house calls', 422)
      }

      const { data: areas } = await db.rpc('service_areas_containing', {
        p_provider: body.provider_id,
        p_lat: clientLat,
        p_lng: clientLng,
      })
      if (!areas || areas.length === 0) {
        return error('travel_out_of_range', 'Address outside the provider’s service area', 409)
      }
      const estimate = await routeEstimate({ lat: provider.lat, lng: provider.lng }, { lat: clientLat, lng: clientLng })
      const area = areas[0]
      if (estimate.distanceKm > area.max_travel_km) {
        return error('travel_out_of_range', 'Beyond the provider’s maximum travel distance', 409)
      }
      travelFee = Math.round(area.travel_base_fee_minor + estimate.distanceKm * area.travel_per_km_minor)
      location = {
        client_label: clientLabel ?? null,
        client_place_id: body.client_place_id ?? null,
        lat: clientLat,
        lng: clientLng,
        distance_km: estimate.distanceKm,
        duration_min: estimate.durationMin,
      }
    } else if (body.service_location_id) {
      const { data: loc } = await db
        .from('provider_service_locations')
        .select('id, provider_id, active')
        .eq('id', body.service_location_id)
        .maybeSingle()
      if (!loc || loc.provider_id !== body.provider_id || !loc.active) {
        return error('meeting_location_invalid', 'Invalid meeting location for this provider', 409)
      }
      location = { service_location_id: body.service_location_id }
    }

    // Promo validation (server-side, usage limits enforced in the RPC).
    let discount = 0
    if (body.promo_code) {
      const { data: promo } = await db.rpc('validate_promo', { p_code: body.promo_code })
      if (promo?.valid) {
        discount = promo.discount_minor
        // Record the redemption intent; it is bound to the booking later.
      } else {
        return error('validation', `Promo code not usable: ${promo?.reason ?? 'invalid'}`, 422)
      }
    }

    // ---- Create the booking (DB-side re-validates price + availability).
    const { data: created, error: createErr } = await db.rpc('create_booking', {
      p_client: userId,
      p_provider: body.provider_id,
      p_service: body.service_id,
      p_duration_min: body.duration_min,
      p_starts_at: body.starts_at,
      p_arrangement: body.meeting_arrangement,
      p_travel_fee_minor: travelFee,
      p_discount_minor: discount,
      p_client_notes: body.notes ?? null,
      p_location: location,
    })
    if (createErr) {
      const msg = createErr.message
      if (msg.includes('slot_unavailable')) return error('slot_unavailable', 'That time was just taken', 409)
      if (msg.includes('notice_period')) return error('validation', 'Too little notice for this provider', 422)
      return error('internal', msg, 500)
    }

    const bookingId = created.booking_id as string
    const total = created.total_minor as number

    // Bind promo redemption to the booking.
    if (body.promo_code && discount > 0) {
      await db.from('promo_redemptions').upsert({
        code: body.promo_code.toUpperCase(),
        user_id: userId,
        booking_id: bookingId,
      })
    }

    // ---- Payment intent.
    const { data: userProfile } = await db.from('profiles').select('id').eq('id', userId).single()
    const gateway = getGateway()
    const intent = await gateway.createIntent({
      bookingId,
      amountMinor: total,
      currency: created.currency as string,
      customerEmail: userProfile ? `${userId}@users.pillowthief.app` : 'unknown',
      metadata: { booking_id: bookingId },
    })

    const { error: payErr } = await db.from('payments').insert({
      booking_id: bookingId,
      client_id: userId,
      provider_id: body.provider_id,
      gateway: intent.gateway,
      gateway_intent_id: intent.intentId,
      status: 'created',
      amount_minor: total,
      currency: created.currency,
    })
    if (payErr) {
      // Compensate: the booking would otherwise hold the slot unpaid forever;
      // the expiry sweeper releases it after 30 minutes either way.
      console.error('payment row insert failed', payErr)
      return error('payment_failed', 'Could not initialise payment', 500)
    }

    return json({
      booking_id: bookingId,
      status: 'pending_payment',
      total_minor: total,
      currency: created.currency,
      payment: intent,
    })
  } catch (err) {
    if (err instanceof z.ZodError) return error('validation', err.errors[0]?.message ?? 'Invalid input', 422)
    if (err instanceof Error && err.message === 'auth_required') return error('auth_required', 'Sign in required', 401)
    console.error(err)
    return error('internal', 'Booking failed', 500)
  }
})
