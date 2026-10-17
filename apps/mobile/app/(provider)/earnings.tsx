import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Card, EmptyState, ErrorState, StatusPill } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'
import { fmtDate, fmtMoney } from '../../src/lib/format'
import { earningsBreakdown } from '@pillow-thief/shared'

export default function ProviderEarnings() {
  const t = useTheme()
  const userId = useSession((s) => s.userId)

  const q = useQuery({
    queryKey: ['my-earnings', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = requireSupabase()
      const [{ data: payouts }, { data: commission }] = await Promise.all([
        sb.from('provider_payouts').select('*').eq('provider_id', userId!).order('period_end', { ascending: false }).limit(12),
        sb.from('platform_settings').select('commission_bps').eq('id', true).single(),
      ])
      return { payouts: payouts ?? [], commissionBps: commission?.commission_bps ?? 1500 }
    },
  })

  const payouts = q.data?.payouts ?? []
  const totals = payouts.reduce(
    (acc, p) => ({ gross: acc.gross + p.gross_minor, commission: acc.commission + p.commission_minor, net: acc.net + p.net_minor }),
    { gross: 0, commission: 0, net: 0 },
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Earnings & payouts' }} />
      <FlatList
        data={payouts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          <>
            <Card style={{ marginBottom: spacing.md, backgroundColor: t.premium }}>
              <Text style={{ color: '#E6D2C2', fontSize: typography.size.sm }}>Net earnings (all periods shown)</Text>
              <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxxl, marginTop: 4 }}>
                {fmtMoney(totals.net)}
              </Text>
              <Text style={{ color: '#E6D2C2', fontSize: typography.size.xs, marginTop: spacing.sm }}>
                Gross {fmtMoney(totals.gross)} · Platform commission {fmtMoney(totals.commission)}
              </Text>
            </Card>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: spacing.lg }}>
              Earnings = gross booking value − commission ({(q.data?.commissionBps ?? 1500) / 100}%) − refunds. Payouts are issued on the configured schedule. Amounts are exact minor-unit totals from the ledger.
            </Text>
          </>
        }
        ListEmptyComponent={
          q.isLoading ? null : q.isError ? (
            <ErrorState message="Couldn't load earnings." onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="wallet-outline" title="No payouts yet" body="Once you complete bookings, earnings and payout records appear here." />
          )
        }
        renderItem={({ item }) => {
          const bd = earningsBreakdown({
            grossMinor: item.gross_minor,
            currency: item.currency,
            commissionBps: q.data?.commissionBps ?? 1500,
            refundMinor: item.refunds_minor,
            adjustmentMinor: item.adjustments_minor,
          })
          return (
            <Card style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>
                  {fmtDate(item.period_start)} → {fmtDate(item.period_end)}
                </Text>
                <StatusPill status={item.status} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>Gross</Text>
                <Text style={{ color: t.text, fontSize: typography.size.sm }}>{fmtMoney(bd.gross.amount, item.currency)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>Commission</Text>
                <Text style={{ color: t.text, fontSize: typography.size.sm }}>−{fmtMoney(bd.commission.amount, item.currency)}</Text>
              </View>
              {bd.refunds.amount > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>Refunds</Text>
                  <Text style={{ color: t.text, fontSize: typography.size.sm }}>−{fmtMoney(bd.refunds.amount, item.currency)}</Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: t.border, marginTop: spacing.sm, paddingTop: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>Net payout</Text>
                <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold }}>{fmtMoney(bd.net.amount, item.currency)}</Text>
              </View>
            </Card>
          )
        }}
      />
    </View>
  )
}
