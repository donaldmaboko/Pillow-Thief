// ============================================================================
// Google Maps Platform client (server-side).
//
// The server key lives in GOOGLE_MAPS_SERVER_KEY (never shipped to clients).
// If the key is absent, callers MUST degrade gracefully — e.g. fall back to
// haversine distance estimates clearly labelled as approximations — and the
// response flags `degraded: true` so the UI can explain itself.
// ============================================================================

export interface RouteEstimate {
  distanceKm: number
  durationMin: number
  /** true when the Routes API was used; false when we fell back to estimates. */
  live: boolean
}

function serverKey(): string | null {
  return Deno.env.get('GOOGLE_MAPS_SERVER_KEY') ?? null
}

/** Haversine straight-line distance in km. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (v: number) => (v * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/**
 * Road distance + duration via the Routes API (computeRoutes).
 * Falls back to a haversine estimate (x1.3 road factor) when no API key is
 * configured or the request fails — never silently invents a route.
 */
export async function routeEstimate(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): Promise<RouteEstimate> {
  const key = serverKey()
  const fallbackKm = haversineKm(from.lat, from.lng, to.lat, to.lng) * 1.3

  if (!key) {
    return { distanceKm: round2(fallbackKm), durationMin: Math.ceil((fallbackKm / 30) * 60), live: false }
  }

  try {
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    })
    if (!res.ok) {
      console.error(`Routes API ${res.status}: ${await res.text()}`)
      return { distanceKm: round2(fallbackKm), durationMin: Math.ceil((fallbackKm / 30) * 60), live: false }
    }
    const data = await res.json()
    const route = data.routes?.[0]
    if (!route) throw new Error('no_route')
    return {
      distanceKm: round2(route.distanceMeters / 1000),
      durationMin: Math.ceil(parseInt(route.duration, 10) / 60),
      live: true,
    }
  } catch (err) {
    console.error('Routes API failure, using haversine fallback:', err)
    return { distanceKm: round2(fallbackKm), durationMin: Math.ceil((fallbackKm / 30) * 60), live: false }
  }
}

/**
 * Verify a Google Places place_id and return its coordinates (Geocoding /
 * Places Details). Used to bind meeting addresses server-side.
 */
export async function resolvePlaceId(placeId: string): Promise<{ lat: number; lng: number; label: string } | null> {
  const key = serverKey()
  if (!key) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'geometry,formatted_address,name')
    url.searchParams.set('key', key)
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'OK' || !data.result?.geometry?.location) return null
    return {
      lat: data.result.geometry.location.lat,
      lng: data.result.geometry.location.lng,
      label: data.result.formatted_address ?? data.result.name ?? placeId,
    }
  } catch {
    return null
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
