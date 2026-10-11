// ============================================================================
// booking-quote — server-side travel fee + price quote.
//
// POST {
//   provider_id, service_id, duration_min, starts_at,
//   meeting_arrangement, client_place_id?, client_lat?, client_lng?
// }
//
// Returns the authoritative price breakdown. The client NEVER supplies
// prices or distances; both are computed here from the database + Routes API.
// ============================================================================

import { z } from 'zod'
import { corsHeaders, error, json, optionsResponse, readJsonBody } from '../_shared/http.ts'
import { supabaseAdmin } from '../_shared/supabase.ts'
import { haversineKm, resolvePlaceId, routeEstimate } from '../_shared/google.ts'

const bodySchema = z.object({
  provider_id: z.string().uuid(),
  service_id: z.string().uuid(),
  duration_min: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(120)]),
  starts_at: z.string().datetime(),
  meeting_arrangement: z.enum(['provider_travels', 'client_visits', 'public_meeting']),
  client_place_id: z.string().max(200).optional(),
  client_lat: z.number().min(-90).max(90).optional(),
  client_lng: z.number().min(-180).max(180).optional(),
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return optionsResponse()
  try {
    const { data: raw } = await readJsonBody(req)
    const body = bodySchema.parse(raw)
    const db = supabaseAdmin()

    // Provider must be discoverable.
    const { data: provider, error: pErr } = await db
      .from('provider_discovery')
      .select('*')
      .eq('provider_id', body.provider_id)
      .maybeSingle()
    if (pErr) return error('external_service', pErr.message, 500)
    if (!provider) return error('provider_not_approved', 'Provider not found or not published', 404)

    if (!provider.accepts.includes(body.meeting_arrangement)) {
      return error('meeting_location_invalid', 'Provider does not offer this meeting arrangement', 409)
    }

    // Service + duration price (authoritative, from DB).
    const { data: service, error: sErr } = await db
      .from('provider_services')
      .select('*')
      .eq('id', body.service_id)
      .eq('provider_id', body.provider_id)
      .eq('active', true)
      .maybeSingle()
    if (sErr) return error('external_service', sErr.message, 500)
    if (!service) return error('service_not_found', 'Service not found', 404)

    const priceByDuration: Record<number, number | null> = {
      30: service.price_30_minor,
      60: service.price_60_minor,
      90: service.price_90_minor,
      120: service.price_120_minor,
    }
    const sessionPrice = priceByDuration[body.duration_min]
    if (sessionPrice == null) return error('duration_not_offered', 'Duration not offered for this service', 409)

    // Availability check (server-side).
    const { data: slotOk, error: slotErr } = await db.rpc('slot_is_available', {
      p_provider: body.provider_id,
      p_start: body.starts_at,
      p_duration_min: body.duration_min,
    })
    if (slotErr) return error('external_service', slotErr.message, 500)
    if (!slotOk) return error('slot_unavailable', 'That time is no longer available', 409)

    // Platform settings: fees, tax, currency.
    const { data: settings } = await db.from('platform_settings').select('*').eq('id', true).single()
    const bookingFee = settings?.booking_fee_minor ?? 0
    const taxBps = settings?.tax_rate_bps ?? 0

    // Travel fee — only when the provider travels to the client.
    let travelFee = 0
    let travel: {
      distance_km: number | null
      duration_min: number | null
      live: boolean
      area_id?: string
      client_lat?: number
      client_lng?: number
      client_label?: string
      client_place_id?: string
    } = { distance_km: null, duration_min: null, live: false }

    if (body.meeting_arrangement === 'provider_travels') {
      // Resolve client coordinates: place_id first, else explicit lat/lng.
      let clientLat = body.client_lat
      let clientLng = body.client_lng
      let clientLabel: string | undefined
      if (body.client_place_id) {
        const resolved = await resolvePlaceId(body.client_place_id)
        if (resolved) {
          clientLat = resolved.lat
          clientLng = resolved.lng
          clientLabel = resolved.label
        }
      }
      if (clientLat == null || clientLng == null) {
        return error('meeting_location_invalid', 'A valid client location is required for house calls', 422)
      }

      // Which of the provider's house-call areas contains this point?
      const { data: areas, error: aErr } = await db.rpc('service_areas_containing', {
        p_provider: body.provider_id,
        p_lat: clientLat,
        p_lng: clientLng,
      })
      if (aErr) return error('external_service', aErr.message, 500)
      if (!areas || areas.length === 0) {
        return error('travel_out_of_range', 'This address is outside the provider’s service area', 409)
      }

      // Road distance from provider base to the client (Routes API).
      const estimate = await routeEstimate({ lat: provider.lat, lng: provider.lng }, { lat: clientLat, lng: clientLng })

      const area = areas[0]
      if (estimate.distanceKm > area.max_travel_km) {
        return error('travel_out_of_range', 'Distance exceeds the provider’s maximum travel distance', 409)
      }

      travelFee = Math.round(area.travel_base_fee_minor + estimate.distanceKm * area.travel_per_km_minor)
      travel = {
        distance_km: estimate.distanceKm,
        duration_min: estimate.durationMin,
        live: estimate.live,
        area_id: area.id,
        client_lat: clientLat,
        client_lng: clientLng,
        client_label: clientLabel,
        client_place_id: body.client_place_id,
      }
    }

    const subtotal = sessionPrice + travelFee + bookingFee
    const tax = Math.round((subtotal * taxBps) / 10000)
    const total = subtotal + tax

    return json({
      currency: service.currency,
      session_price_minor: sessionPrice,
      travel_fee_minor: travelFee,
      booking_fee_minor: bookingFee,
      tax_minor: tax,
      total_minor: total,
      travel,
      degraded_travel: body.meeting_arrangement === 'provider_travels' ? !travel.live : false,
      travel_is_estimate: body.meeting_arrangement === 'provider_travels',
    })
  } catch (err) {
    if (err instanceof z.ZodError) return error('validation', err.errors[0]?.message ?? 'Invalid input', 422)
    console.error(err)
    return error('internal', 'Quote failed', 500)
  }
})
