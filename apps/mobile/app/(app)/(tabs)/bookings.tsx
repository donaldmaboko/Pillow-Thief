import React, { useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Card, Chip, EmptyState, ErrorState, StatusPill } from '../../../src/components/ui'
import { spacing, typography, useTheme } from '../../../src/theme'
import { useMyBookings } from '../../../src/lib/queries'
import { fmtDateTime, fmtDuration, fmtMoney } from '../../../src/lib/format'
import { BOOKING_STATUS_LABELS, type BookingStatus } from '@pillow-thief/shared'

type Filter = 'upcoming' | 'past' | 'all'

export default function Bookings() {
  const t = useTheme()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const query = useMyBookings()
  const all = query.data ?? []
  const now = new Date()

  const visible = all.filter((b) => {
    if (filter === 'upcoming') return new Date(b.starts_at) >= now && !['completed', 'cancelled', 'declined', 'expired'].includes(b.status)
    if (filter === 'past') return new Date(b.starts_at) < now || ['completed', 'cancelled', 'declined', 'expired'].includes(b.status)
    return true
  })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ padding: spacing.lg, flex: 1 }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.md }}>
          Your bookings
        </Text>
        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {(['upcoming', 'past', 'all'] as Filter[]).map((f) => (
            <Chip key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }}>
          {query.isLoading ? (
            <Text style={{ color: t.textMuted }}>Loading…</Text>
          ) : query.isError ? (
            <ErrorState message="Couldn't load bookings." onRetry={() => query.refetch()} />
          ) : visible.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title={filter === 'upcoming' ? 'No upcoming sessions' : 'Nothing here yet'}
              body={filter === 'upcoming' ? 'When you book a cuddle it will appear here.' : 'Your booking history will appear here.'}
              action={filter === 'upcoming' ? 'Find a cuddle' : undefined}
              onAction={filter === 'upcoming' ? () => router.push('/(app)/(tabs)/explore') : undefined}
            />
          ) : (
            visible.map((b) => {
              const providerName = b.provider_profiles?.display_name ?? 'Provider'
              const serviceTitle = b.provider_services?.title ?? 'Session'
              return (
                <Card key={b.id} style={{ marginBottom: spacing.md }} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>{providerName}</Text>
                      <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{serviceTitle} · {fmtDuration(b.duration_min)}</Text>
                      <Text style={{ color: t.text, fontSize: typography.size.sm, fontFamily: typography.fontFamily.semibold }}>
                        {fmtDateTime(b.starts_at)}
                      </Text>
                      <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm }}>
                        {fmtMoney(b.total_minor, b.currency)}
                      </Text>
                    </View>
                    <StatusPill status={b.status} label={BOOKING_STATUS_LABELS[b.status as BookingStatus] ?? b.status} />
                  </View>
                </Card>
              )
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
