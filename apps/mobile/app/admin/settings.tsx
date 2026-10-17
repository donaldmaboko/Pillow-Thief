import React, { useEffect, useState } from 'react'
import { Alert, ScrollView, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Card, CardSkeleton, ErrorState, Field } from '../../src/components/ui'
import { usePlatformSettings } from '../../src/features/admin/useAdminData'
import { useUpdatePlatformSettings } from '../../src/features/admin/useAdminActions'
import { errorMessage } from '../../src/lib/api'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'
import { spacing, typography, useTheme } from '../../src/theme'

export default function AdminSettings() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const q = usePlatformSettings()
  const save = useUpdatePlatformSettings()

  const [commission, setCommission] = useState('')
  const [bookingFee, setBookingFee] = useState('')
  const [taxRate, setTaxRate] = useState('')
  const [maintenance, setMaintenance] = useState(false)
  const [bookingsEnabled, setBookingsEnabled] = useState(true)

  // Seed the form once the settings arrive.
  useEffect(() => {
    if (!q.data) return
    setCommission((q.data.commission_bps / 100).toString())
    setBookingFee((q.data.booking_fee_minor / 100).toString())
    setTaxRate((q.data.tax_rate_bps / 100).toString())
    setMaintenance(q.data.maintenance_mode)
    setBookingsEnabled(q.data.bookings_enabled)
  }, [q.data])

  const signOut = async () => {
    const sb = requireSupabase()
    await sb.auth.signOut()
    useSession.getState().signOut()
    router.replace('/(auth)/welcome')
  }

  const onSave = async () => {
    const commissionBps = Math.round(Number(commission) * 100)
    const bookingFeeMinor = Math.round(Number(bookingFee) * 100)
    const taxBps = Math.round(Number(taxRate) * 100)

    if (![commissionBps, bookingFeeMinor, taxBps].every((n) => Number.isFinite(n) && n >= 0)) {
      Alert.alert('Check those numbers', 'Commission, booking fee and tax must be positive numbers.')
      return
    }
    if (commissionBps > 9000 || taxBps > 9000) {
      Alert.alert('Out of range', 'Commission and tax are capped at 90% by the database.')
      return
    }

    try {
      await save.mutateAsync({
        commission_bps: commissionBps,
        booking_fee_minor: bookingFeeMinor,
        tax_rate_bps: taxBps,
        maintenance_mode: maintenance,
        bookings_enabled: bookingsEnabled,
      })
      Alert.alert('Saved', 'Platform settings updated.')
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err))
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
          Platform settings
        </Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.lg }}>
          Signed in as {profile?.display_name ?? 'admin'}
        </Text>

        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : !q.data ? (
          <CardSkeleton />
        ) : (
          <>
            <Card style={{ marginBottom: spacing.lg }}>
              <Field
                label="Commission (%)"
                value={commission}
                onChangeText={setCommission}
                keyboardType="decimal-pad"
                hint="Platform share of each booking."
              />
              <Field
                label="Booking fee"
                value={bookingFee}
                onChangeText={setBookingFee}
                keyboardType="decimal-pad"
                hint={`Shown to clients as an added fee, in ${q.data.currency}.`}
              />
              <Field
                label="Tax rate (%)"
                value={taxRate}
                onChangeText={setTaxRate}
                keyboardType="decimal-pad"
                style={{ marginBottom: 0 }}
              />
            </Card>

            <Card style={{ marginBottom: spacing.lg }}>
              <ToggleRow
                label="Bookings enabled"
                hint="Turn off to pause all new bookings."
                value={bookingsEnabled}
                onChange={setBookingsEnabled}
              />
              <ToggleRow
                label="Maintenance mode"
                hint="Shows a maintenance notice across the apps."
                value={maintenance}
                onChange={setMaintenance}
              />
            </Card>

            <Button title="Save settings" loading={save.isPending} onPress={() => void onSave()} />

            <Button title="Sign out" variant="danger" style={{ marginTop: spacing.lg }} onPress={() => void signOut()} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: (next: boolean) => void
}) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md }}>{label}</Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 2 }}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary, false: t.border }} />
    </View>
  )
}
