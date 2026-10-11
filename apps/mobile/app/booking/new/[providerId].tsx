import React, { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMutation } from '@tanstack/react-query'
import { Button, Card, Chip, ErrorState, PriceRow, SafetyAlert } from '../../../src/components/ui'
import { radius, spacing, typography, useTheme } from '../../../src/theme'
import { useAvailableSlots, useProviderProfile, useQuote } from '../../../src/lib/queries'
import { api, errorMessage } from '../../../src/lib/api'
import { fmtDuration, fmtMoney, minutesToHHmm } from '../../../src/lib/format'
import { MEETING_ARRANGEMENT_LABELS, type MeetingArrangement } from '@pillow-thief/shared'

type Step = 'service' | 'duration' | 'datetime' | 'meeting' | 'summary'

export default function BookingWizard() {
  const { providerId } = useLocalSearchParams<{ providerId: string }>()
  const t = useTheme()
  const router = useRouter()
  const profile = useProviderProfile(providerId)

  const [step, setStep] = useState<Step>('service')
  const [serviceId, setServiceId] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [dateISO, setDateISO] = useState<string | null>(null)
  const [startMinute, setStartMinute] = useState<number | null>(null)
  const [arrangement, setArrangement] = useState<MeetingArrangement | null>(null)
  const [addressLabel, setAddressLabel] = useState('')
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [promo, setPromo] = useState('')

  const provider = profile.data?.discovery
  const services = profile.data?.services ?? []
  const locations = profile.data?.locations ?? []
  const areas = profile.data?.areas ?? []
  const service = services.find((s) => s.id === serviceId)

  const offeredDurations = useMemo(() => {
    if (!service) return []
    return ([
      [30, service.price_30_minor],
      [60, service.price_60_minor],
      [90, service.price_90_minor],
      [120, service.price_120_minor],
    ] as [number, number | null][]).filter(([, price]) => price != null)
  }, [service])

  // Next 14 days for the date picker.
  const days = useMemo(() => {
    const out: { iso: string; label: string }[] = []
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)
      out.push({
        iso: d.toISOString().slice(0, 10),
        label: new Intl.DateTimeFormat('en-BW', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Africa/Gaborone' }).format(d),
      })
    }
    return out
  }, [])

  const slots = useAvailableSlots(providerId, dateISO ?? undefined, duration ?? 60)

  const startsAtISO = useMemo(() => {
    if (!dateISO || startMinute == null) return null
    // Convert local Gaborone date + minutes to UTC ISO for the backend.
    const local = new Date(`${dateISO}T00:00:00+02:00`) // CAT (Africa/Gaborone, no DST)
    return new Date(local.getTime() + startMinute * 60_000).toISOString()
  }, [dateISO, startMinute])

  const quoteParams = useMemo(() => {
    if (!providerId || !serviceId || !duration || !startsAtISO || !arrangement) return null
    const base: Record<string, unknown> = {
      provider_id: providerId,
      service_id: serviceId,
      duration_min: duration,
      starts_at: startsAtISO,
      meeting_arrangement: arrangement,
    }
    if (arrangement === 'provider_travels' && lat != null && lng != null) {
      base.client_lat = lat
      base.client_lng = lng
      base.client_place_id = undefined
      base.client_address_label = addressLabel
    }
    if (arrangement !== 'provider_travels') {
      base.service_location_id = locations[0]?.id
    }
    return base
  }, [providerId, serviceId, duration, startsAtISO, arrangement, lat, lng, locations, addressLabel])

  const quote = useQuote(step === 'summary' ? quoteParams : null)

  const create = useMutation({
    mutationFn: () =>
      api.createBooking({
        provider_id: providerId,
        service_id: serviceId,
        duration_min: duration,
        starts_at: startsAtISO,
        meeting_arrangement: arrangement,
        client_lat: arrangement === 'provider_travels' ? lat : undefined,
        client_lng: arrangement === 'provider_travels' ? lng : undefined,
        client_address_label: arrangement === 'provider_travels' ? addressLabel : undefined,
        service_location_id: arrangement !== 'provider_travels' ? locations[0]?.id : undefined,
        promo_code: promo || undefined,
        notes: notes || undefined,
      }),
    onSuccess: (res) => {
      router.replace({ pathname: '/checkout/[bookingId]', params: { bookingId: res.booking_id, intentId: res.payment.intentId, gateway: res.payment.gateway } })
    },
    onError: (err) => Alert.alert('Booking failed', errorMessage(err)),
  })

  const canNext =
    (step === 'service' && serviceId) ||
    (step === 'duration' && duration) ||
    (step === 'datetime' && dateISO && startMinute != null) ||
    (step === 'meeting' && arrangement && (arrangement !== 'provider_travels' || (lat != null && lng != null && addressLabel)))

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: provider?.display_name ?? 'Book a session' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* ------- STEP: service ------- */}
        {step === 'service' ? (
          <>
            <StepTitle n={1} title="Choose a service" />
            {services.length === 0 ? (
              <ErrorState message="This provider has no active services." />
            ) : (
              services.map((s) => (
                <Card
                  key={s.id}
                  style={{ marginBottom: spacing.md, borderWidth: serviceId === s.id ? 2 : 0, borderColor: t.primary }}
                  onPress={() => { setServiceId(s.id); setDuration(null) }}
                >
                  <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>{s.title}</Text>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4 }}>{s.description}</Text>
                  <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, marginTop: spacing.sm }}>
                    from {fmtMoney(Math.min(s.price_60_minor, s.price_30_minor ?? s.price_60_minor), s.currency)}
                  </Text>
                </Card>
              ))
            )}
          </>
        ) : null}

        {/* ------- STEP: duration ------- */}
        {step === 'duration' ? (
          <>
            <StepTitle n={2} title="Session length" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {offeredDurations.map(([dur, price]) => (
                <Pressable
                  key={dur}
                  onPress={() => setDuration(dur)}
                  style={{
                    backgroundColor: duration === dur ? t.primary : t.surface,
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.xl,
                    paddingVertical: spacing.lg,
                    borderWidth: 1.5,
                    borderColor: duration === dur ? t.primary : t.border,
                    alignItems: 'center',
                    minWidth: 100,
                  }}
                >
                  <Text style={{ color: duration === dur ? t.textOnPrimary : t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
                    {fmtDuration(dur)}
                  </Text>
                  <Text style={{ color: duration === dur ? t.textOnPrimary : t.textMuted, fontSize: typography.size.sm, marginTop: 4 }}>
                    {fmtMoney(price!, service!.currency)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* ------- STEP: datetime ------- */}
        {step === 'datetime' ? (
          <>
            <StepTitle n={3} title="Pick a date & time" t="Africa/Gaborone" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row' }}>
                {days.map((d) => (
                  <Chip key={d.iso} label={d.label} selected={dateISO === d.iso} onPress={() => { setDateISO(d.iso); setStartMinute(null) }} />
                ))}
              </View>
            </ScrollView>
            {dateISO ? (
              slots.isLoading ? (
                <Text style={{ color: t.textMuted }}>Checking availability…</Text>
              ) : (slots.data ?? []).length === 0 ? (
                <Text style={{ color: t.textMuted }}>No open slots on this day for {fmtDuration(duration ?? 60)} — try another day.</Text>
              ) : (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {(slots.data ?? []).map((s) => (
                    <Pressable
                      key={s.start_minute}
                      onPress={() => setStartMinute(s.start_minute)}
                      style={{
                        backgroundColor: startMinute === s.start_minute ? t.primary : t.surface,
                        borderRadius: radius.md,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm,
                        borderWidth: 1,
                        borderColor: startMinute === s.start_minute ? t.primary : t.border,
                      }}
                    >
                      <Text style={{ color: startMinute === s.start_minute ? t.textOnPrimary : t.text, fontFamily: typography.fontFamily.semibold }}>
                        {minutesToHHmm(s.start_minute)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )
            ) : (
              <Text style={{ color: t.textMuted }}>Select a date above.</Text>
            )}
          </>
        ) : null}

        {/* ------- STEP: meeting arrangement ------- */}
        {step === 'meeting' ? (
          <>
            <StepTitle n={4} title="Where should you meet?" />
            {((provider?.accepts ?? []) as string[]).map((a: string) => (
              <Card
                key={a}
                style={{ marginBottom: spacing.md, borderWidth: arrangement === a ? 2 : 0, borderColor: t.primary }}
                onPress={() => setArrangement(a as MeetingArrangement)}
              >
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>{MEETING_ARRANGEMENT_LABELS[a as MeetingArrangement]}</Text>
                <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4 }}>
                  {a === 'provider_travels' && 'Your provider travels to an address you choose inside their service area. Exact address is shared only after the booking is confirmed.'}
                  {a === 'client_visits' && 'Visit one of the provider’s approved service locations.'}
                  {a === 'public_meeting' && 'Meet at an agreed public place approved by the provider.'}
                </Text>
              </Card>
            ))}

            {arrangement === 'provider_travels' ? (
              <Card style={{ marginTop: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>Your location</Text>
                {areas.length > 0 ? (
                  <>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm }}>
                      {areas.map((a) => (
                        <Pressable
                          key={a.id}
                          onPress={() => {
                            // Approximate area centre (privacy-safe zone centre).
                            setAddressLabel(a.name)
                            setLat(a.lat)
                            setLng(a.lng)
                          }}
                          style={{ backgroundColor: t.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 }}
                        >
                          <Text style={{ color: t.text, fontSize: typography.size.sm }}>{a.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: spacing.sm }}>
                      Pick your area, then type a meeting point label (e.g. "Main Mall office block"). In production builds this uses Google Places Autocomplete for precise address selection.
                    </Text>
                  </>
                ) : null}
                <TextInput
                  value={addressLabel}
                  onChangeText={setAddressLabel}
                  placeholder="Meeting point label / address"
                  placeholderTextColor={t.textMuted}
                  style={{ backgroundColor: t.bg, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, padding: spacing.md, color: t.text }}
                />
              </Card>
            ) : null}

            {arrangement !== 'provider_travels' && locations.length > 0 ? (
              <Card style={{ marginTop: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>Approved meeting locations</Text>
                {locations.map((l) => (
                  <Text key={l.id} style={{ color: t.textMuted, fontSize: typography.size.sm, paddingVertical: 2 }}>
                    • {l.name} — {l.address}
                  </Text>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {/* ------- STEP: summary ------- */}
        {step === 'summary' ? (
          <>
            <StepTitle n={5} title="Review & confirm" />
            <Card style={{ marginBottom: spacing.md }}>
              <PriceRow label={service!.title} value={`${fmtDuration(duration!)} · ${dateISO} ${startMinute != null ? minutesToHHmm(startMinute) : ''}`} />
              <PriceRow label="Meeting" value={MEETING_ARRANGEMENT_LABELS[arrangement!]} muted />
              {arrangement === 'provider_travels' && addressLabel ? <PriceRow label="Meeting point" value={addressLabel} muted /> : null}
            </Card>

            {quote.isLoading ? (
              <Text style={{ color: t.textMuted }}>Calculating your price…</Text>
            ) : quote.isError ? (
              <ErrorState message={errorMessage(quote.error)} />
            ) : quote.data ? (
              <Card style={{ marginBottom: spacing.md }}>
                <PriceRow label="Session price" value={fmtMoney(quote.data.session_price_minor, quote.data.currency)} />
                {quote.data.travel_fee_minor > 0 ? (
                  <PriceRow label="Travel fee" value={fmtMoney(quote.data.travel_fee_minor, quote.data.currency)} />
                ) : null}
                {quote.data.booking_fee_minor > 0 ? (
                  <PriceRow label="Booking fee" value={fmtMoney(quote.data.booking_fee_minor, quote.data.currency)} />
                ) : null}
                {quote.data.tax_minor > 0 ? <PriceRow label="Tax" value={fmtMoney(quote.data.tax_minor, quote.data.currency)} /> : null}
                <View style={{ borderTopWidth: 1, borderTopColor: t.border, marginTop: spacing.sm }}>
                  <PriceRow label="Total" value={fmtMoney(quote.data.total_minor, quote.data.currency)} bold />
                </View>
                {quote.data.travel_is_estimate ? (
                  <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs }}>
                    Travel time and distance are estimates{quote.data.degraded_travel ? ' (live routing unavailable — straight-line estimate shown)' : ''}. The final travel fee is fixed at booking time.
                  </Text>
                ) : null}
              </Card>
            ) : null}

            <TextInput
              value={promo}
              onChangeText={setPromo}
              placeholder="Promo code (optional)"
              placeholderTextColor={t.textMuted}
              autoCapitalize="characters"
              style={{ backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, padding: spacing.md, color: t.text, marginBottom: spacing.md }}
            />
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Anything your provider should know? (optional)"
              placeholderTextColor={t.textMuted}
              multiline
              style={{ backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, padding: spacing.md, color: t.text, minHeight: 70, marginBottom: spacing.md }}
            />

            <SafetyAlert
              title="Before you confirm"
              body="All sessions are non-sexual. Cancellation terms follow the provider's policy shown on their profile. You'll complete a consent & boundaries checklist before the session."
            />
          </>
        ) : null}
      </ScrollView>

      {/* Footer nav */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.border, flexDirection: 'row', gap: spacing.md }}>
        {step !== 'service' ? (
          <Button
            title="Back"
            variant="secondary"
            onPress={() => {
              const order: Step[] = ['service', 'duration', 'datetime', 'meeting', 'summary']
              setStep(order[order.indexOf(step) - 1] ?? 'service')
            }}
            style={{ flex: 1 }}
          />
        ) : null}
        {step !== 'summary' ? (
          <Button title="Continue" onPress={() => {
            const order: Step[] = ['service', 'duration', 'datetime', 'meeting', 'summary']
            setStep(order[order.indexOf(step) + 1] ?? 'summary')
          }} disabled={!canNext} style={{ flex: 2 }} />
        ) : (
          <Button
            title="Request booking"
            loading={create.isPending}
            disabled={!quote.data || quote.isLoading}
            onPress={() => create.mutate()}
            style={{ flex: 2 }}
          />
        )}
      </View>
    </View>
  )
}

function StepTitle({ n, title, t: sub }: { n: number; title: string; t?: string }) {
  const theme = useTheme()
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ color: theme.primaryDark, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 1 }}>
        Step {n} of 5 {sub ? `· ${sub}` : ''}
      </Text>
      <Text style={{ color: theme.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{title}</Text>
    </View>
  )
}
