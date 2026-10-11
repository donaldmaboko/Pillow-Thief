import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, PriceRow, SafetyAlert } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { api } from '../../src/lib/api'
import { useBooking } from '../../src/lib/queries'
import { fmtMoney } from '../../src/lib/format'

export default function Checkout() {
  const { bookingId, intentId } = useLocalSearchParams<{ bookingId: string; intentId: string; gateway: string }>()
  const t = useTheme()
  const router = useRouter()
  const booking = useBooking(bookingId)
  const [paying, setPaying] = useState<'captured' | 'failed' | null>(null)

  const b = booking.data
  const isSandbox = intentId?.startsWith('sandbox_')

  const pay = async (outcome: 'captured' | 'failed') => {
    setPaying(outcome)
    try {
      await api.paySandbox({ intent_id: intentId!, outcome })
      // Payment state is authoritative on the server — refresh from there.
      await booking.refetch()
      if (outcome === 'captured') {
        router.replace({ pathname: '/booking/[id]', params: { id: bookingId! } })
      } else {
        Alert.alert('Payment declined', 'No charge was made. You can retry from your bookings within 30 minutes, after which the booking expires.')
        router.replace('/(app)/(tabs)/bookings')
      }
    } catch (err) {
      Alert.alert('Payment error', err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPaying(null)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Checkout' }} />
      <View style={{ padding: spacing.lg, flex: 1, justifyContent: 'space-between' }}>
        <View>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.md }}>
            Secure checkout
          </Text>

          {b ? (
            <Card style={{ marginBottom: spacing.md }}>
              <PriceRow label="Session price" value={fmtMoney(b.session_price_minor, b.currency)} />
              {b.travel_fee_minor > 0 ? <PriceRow label="Travel fee" value={fmtMoney(b.travel_fee_minor, b.currency)} /> : null}
              {b.booking_fee_minor > 0 ? <PriceRow label="Booking fee" value={fmtMoney(b.booking_fee_minor, b.currency)} /> : null}
              {b.tax_minor > 0 ? <PriceRow label="Tax" value={fmtMoney(b.tax_minor, b.currency)} /> : null}
              {b.discount_minor > 0 ? <PriceRow label="Discount" value={`-${fmtMoney(b.discount_minor, b.currency)}`} /> : null}
              <View style={{ borderTopWidth: 1, borderTopColor: t.border, marginTop: spacing.sm }}>
                <PriceRow label="Total" value={fmtMoney(b.total_minor, b.currency)} bold />
              </View>
            </Card>
          ) : null}

          {isSandbox ? (
            <SafetyAlert
              tone="warning"
              title="Sandbox payment"
              body="No real charge will occur — this environment simulates the payment gateway. In production this screen hands off to the configured payment provider's secure interface. Raw card details never touch Pillow Thief servers."
            />
          ) : (
            <SafetyAlert
              title="Secure payment"
              body="Payment details are handled by our payment provider. Pillow Thief never sees or stores raw card numbers."
            />
          )}

          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: spacing.lg, lineHeight: 20 }}>
            By paying you agree to the provider's cancellation policy. Refund windows are measured from the session start time (Africa/Gaborone).
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          <Button title={`Pay ${b ? fmtMoney(b.total_minor, b.currency) : ''}`} icon="lock-closed" loading={paying === 'captured'} onPress={() => pay('captured')} />
          {isSandbox ? (
            <Button title="Simulate declined card" variant="secondary" loading={paying === 'failed'} onPress={() => pay('failed')} />
          ) : null}
          <Button title="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </View>
  )
}
