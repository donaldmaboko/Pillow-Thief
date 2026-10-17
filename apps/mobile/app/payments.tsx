import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Card, EmptyState, ErrorState, StatusPill } from '../src/components/ui'
import { spacing, typography, useTheme } from '../src/theme'
import { requireSupabase } from '../src/lib/supabase'
import { fmtDateTime, fmtMoney } from '../src/lib/format'

export default function PaymentsScreen() {
  const t = useTheme()
  const q = useQuery({
    queryKey: ['my-payments'],
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('payments')
        .select('id, status, amount_minor, currency, captured_at, created_at, bookings(provider_services(title), provider_profiles(display_name))')
        .order('created_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Payment history' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={
          q.isLoading ? null : q.isError ? (
            <ErrorState message="Couldn't load payments." onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="card-outline" title="No payments yet" body="Your receipts and payment history will appear here." />
          )
        }
        renderItem={({ item }) => {
          // deno-lint-ignore no-explicit-any
          const booking = (Array.isArray(item.bookings) ? item.bookings[0] : item.bookings) as any
          return (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>
                    {booking?.provider_services?.title ?? 'Session'}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
                    {booking?.provider_profiles?.display_name} · {fmtDateTime(item.captured_at ?? item.created_at)}
                  </Text>
                  <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: 2 }}>
                    {fmtMoney(item.amount_minor, item.currency)}
                  </Text>
                </View>
                <StatusPill status={item.status} />
              </View>
              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.sm }}>
                {item.status === 'captured' ? 'Paid' : item.status === 'refunded' ? 'Refunded' : item.status === 'failed' ? 'Payment failed — no charge' : 'Pending'}
              </Text>
            </Card>
          )
        }}
      />
    </View>
  )
}
