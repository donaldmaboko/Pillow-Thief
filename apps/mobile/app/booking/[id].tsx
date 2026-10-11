import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, ErrorState, PriceRow, SafetyAlert, StatusPill } from '../../src/components/ui'
import { radius, spacing, typography, useTheme } from '../../src/theme'
import { api, errorMessage } from '../../src/lib/api'
import { useBooking } from '../../src/lib/queries'
import { useSession } from '../../src/stores/session'
import { requireSupabase } from '../../src/lib/supabase'
import { fmtDateTime, fmtDuration, fmtMoney } from '../../src/lib/format'
import { BOOKING_STATUS_LABELS, CONSENT_CONTACT_LABELS, consentChecklistSchema, type BookingStatus, type ConsentChecklist } from '@pillow-thief/shared'
import { useQueryClient } from '@tanstack/react-query'

const DEFAULT_CONSENT: ConsentChecklist = {
  contact: { hugging: 'yes', hand_holding: 'discuss_first', cuddling_seated: 'yes' },
  conversationPreference: 'no_preference',
  clothingExpectation: 'Comfortable casual clothing.',
  personalSpaceNotes: '',
  otherRestrictions: '',
  acknowledgeOngoingConsent: true,
}

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const router = useRouter()
  const qc = useQueryClient()
  const booking = useBooking(id)
  const userId = useSession((s) => s.userId)
  const isProvider = useSession((s) => s.isProvider)
  const [showConsent, setShowConsent] = useState(false)
  const [consent, setConsent] = useState<ConsentChecklist>(DEFAULT_CONSENT)
  const [acting, setActing] = useState(false)

  const b = booking.data
  if (booking.isLoading) return <View style={{ flex: 1, backgroundColor: t.bg }} />
  if (booking.isError || !b) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: spacing.lg }}>
        <ErrorState message="Booking not found." onRetry={() => booking.refetch()} />
      </View>
    )
  }

  const iAmClient = b.client_id === userId
  const status = b.status as BookingStatus
  const loc = Array.isArray(b.booking_locations) ? b.booking_locations[0] : b.booking_locations

  const action = async (name: 'accept' | 'decline' | 'cancel') => {
    if (name === 'cancel' || name === 'decline') {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(
          name === 'cancel' ? 'Cancel this booking?' : 'Decline this booking?',
          name === 'cancel'
            ? 'Refunds follow the cancellation policy. Cancellations close to the session start may not be refundable.'
            : 'Declining a paid booking triggers a full refund for the client.',
          [
            { text: 'Keep booking', style: 'cancel', onPress: () => resolve(false) },
            { text: name === 'cancel' ? 'Cancel booking' : 'Decline', style: 'destructive', onPress: () => resolve(true) },
          ],
        ),
      )
      if (!ok) return
    }
    setActing(true)
    try {
      const res = await api.bookingAction({ action: name, booking_id: b.id })
      if (name === 'cancel' && res.refund_percent != null) {
        Alert.alert('Booking cancelled', res.refund_percent > 0 ? `A ${res.refund_percent}% refund is being processed.` : 'No refund applies under the cancellation policy.')
      } else if (name === 'decline') {
        Alert.alert('Booking declined', 'The client has been notified and a full refund was initiated.')
      }
      await booking.refetch()
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    } catch (err) {
      Alert.alert('Action failed', errorMessage(err))
    } finally {
      setActing(false)
    }
  }

  const saveConsent = async () => {
    const parsed = consentChecklistSchema.safeParse(consent)
    if (!parsed.success) return Alert.alert('Checklist incomplete', parsed.error.errors[0]?.message ?? 'Please complete the checklist.')
    try {
      const sb = requireSupabase()
      const { error } = await sb.from('booking_consent').upsert({
        booking_id: b.id,
        completed_by: userId,
        party: isProvider ? 'provider' : 'client',
        contact: consent.contact,
        conversation_preference: consent.conversationPreference,
        clothing_expectation: consent.clothingExpectation,
        personal_space_notes: consent.personalSpaceNotes,
        other_restrictions: consent.otherRestrictions,
        acknowledge_ongoing_consent: true,
      })
      if (error) throw error
      setShowConsent(false)
      Alert.alert('Saved', 'Your boundaries are saved for this session. You can update them any time before it starts.')
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err))
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Booking details' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <View>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
              {b.provider_services?.title ?? 'Session'}
            </Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
              {b.provider_profiles?.display_name} · {fmtDuration(b.duration_min)}
            </Text>
          </View>
          <StatusPill status={b.status} label={BOOKING_STATUS_LABELS[status] ?? status} />
        </View>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 1 }}>When</Text>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: 4 }}>
            {fmtDateTime(b.starts_at)}
          </Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 2 }}>Africa/Gaborone (CAT)</Text>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm }}>
            Meeting
          </Text>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold }}>
            {b.meeting_arrangement === 'provider_travels' ? 'Provider comes to you' : b.meeting_arrangement === 'client_visits' ? 'You visit the provider’s location' : 'Public meeting place'}
          </Text>
          {loc?.client_label ? <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4 }}>{loc.client_label}</Text> : null}
          {loc?.travel_distance_km != null ? (
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 4 }}>
              ≈ {loc.travel_distance_km} km ({loc.travel_duration_min} min drive — estimate)
            </Text>
          ) : null}
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.sm }}>
            Precise address details are visible only to booking participants.
          </Text>
        </Card>

        <Card style={{ marginBottom: spacing.md }}>
          <PriceRow label="Session" value={fmtMoney(b.session_price_minor, b.currency)} />
          {b.travel_fee_minor > 0 ? <PriceRow label="Travel fee" value={fmtMoney(b.travel_fee_minor, b.currency)} /> : null}
          {b.booking_fee_minor > 0 ? <PriceRow label="Booking fee" value={fmtMoney(b.booking_fee_minor, b.currency)} /> : null}
          {b.tax_minor > 0 ? <PriceRow label="Tax" value={fmtMoney(b.tax_minor, b.currency)} /> : null}
          <View style={{ borderTopWidth: 1, borderTopColor: t.border, marginTop: spacing.sm }}>
            <PriceRow label="Total" value={fmtMoney(b.total_minor, b.currency)} bold />
          </View>
        </Card>

        {/* Payment pending → pay now */}
        {status === 'pending_payment' && iAmClient ? (
          <Button title="Complete payment" icon="card" onPress={() => router.push({ pathname: '/(app)/(tabs)/bookings' })} style={{ marginBottom: spacing.md }} />
        ) : null}

        {/* Consent checklist */}
        {['pending_approval', 'confirmed'].includes(status) ? (
          <Card style={{ marginBottom: spacing.md }}>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>Consent & boundaries</Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.md }}>
              Agree on what the session includes before it starts. Consent is ongoing — either of you may pause or stop at any time.
            </Text>
            {!showConsent ? (
              <Button title="Open checklist" variant="secondary" onPress={() => setShowConsent(true)} />
            ) : (
              <View style={{ gap: spacing.md }}>
                {(Object.keys(CONSENT_CONTACT_LABELS) as (keyof typeof CONSENT_CONTACT_LABELS)[]).map((area) => (
                  <View key={area} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: t.text, fontSize: typography.size.sm, flex: 1 }}>{CONSENT_CONTACT_LABELS[area]}</Text>
                    <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                      {(['yes', 'no', 'discuss_first'] as const).map((opt) => (
                        <PressableChip
                          key={opt}
                          label={opt === 'discuss_first' ? '?' : opt === 'yes' ? '✓' : '✗'}
                          selected={consent.contact[area] === opt}
                          onPress={() => setConsent((c: ConsentChecklist) => ({ ...c, contact: { ...c.contact, [area]: opt } }))}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <Button title="Save my boundaries" onPress={saveConsent} />
                <Button title="Close" variant="ghost" onPress={() => setShowConsent(false)} />
              </View>
            )}
          </Card>
        ) : null}

        {/* Safety */}
        <SafetyAlert
          title="During your session"
          body="If anything feels wrong, you may end the session immediately — no explanation needed and no penalty. Use the Safety centre for support."
        />

        {/* Actions */}
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {isProvider && status === 'pending_approval' ? (
            <>
              <Button title="Accept booking" loading={acting} onPress={() => action('accept')} />
              <Button title="Decline (full refund to client)" variant="secondary" loading={acting} onPress={() => action('decline')} />
            </>
          ) : null}
          {iAmClient && ['pending_payment', 'pending_approval', 'confirmed'].includes(status) ? (
            <Button title="Cancel booking" variant="danger" loading={acting} onPress={() => action('cancel')} />
          ) : null}
          {iAmClient && status === 'completed' ? (
            <Button title="Leave a review" icon="star" onPress={() => router.push({ pathname: '/review/[bookingId]', params: { bookingId: b.id } })} />
          ) : null}
          {status === 'completed' || status === 'disputed' ? (
            <Button title="Report a problem" variant="secondary" icon="flag-outline" onPress={() => router.push('/help')} />
          ) : null}
          {status === 'confirmed' ? (
            <Button title="Message your provider" variant="secondary" icon="chatbubbles-outline" onPress={() => ensureConversation(b.id, b.client_id, b.provider_id, router)} />
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

function PressableChip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const t = useTheme()
  return (
    <View
      style={{
        backgroundColor: selected ? t.primary : t.surfaceMuted,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xs,
        minWidth: 34,
        alignItems: 'center',
      }}
    >
      <Text onPress={onPress} style={{ color: selected ? t.textOnPrimary : t.textMuted, fontFamily: typography.fontFamily.bold }}>
        {label}
      </Text>
    </View>
  )
}

async function ensureConversation(bookingId: string, clientId: string, providerId: string, router: ReturnType<typeof useRouter>) {
  try {
    const sb = requireSupabase()
    const { data: existing } = await sb.from('conversations').select('id').eq('booking_id', bookingId).maybeSingle()
    if (existing) return router.push({ pathname: '/chat/[conversationId]', params: { conversationId: existing.id } })
    const { data: created, error } = await sb
      .from('conversations')
      .insert({ booking_id: bookingId, client_id: clientId, provider_id: providerId })
      .select('id')
      .single()
    if (error) throw error
    router.push({ pathname: '/chat/[conversationId]', params: { conversationId: created.id } })
  } catch (err) {
    Alert.alert('Could not open chat', errorMessage(err))
  }
}
