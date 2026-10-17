import React from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Card, ErrorState, Skeleton } from '../../src/components/ui'
import { useAdminMetrics } from '../../src/features/admin/useAdminData'
import { errorMessage } from '../../src/lib/api'
import { fmtMoney } from '../../src/lib/format'
import { spacing, typography, useTheme } from '../../src/theme'
import { useSession } from '../../src/stores/session'

export default function AdminOverview() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const q = useAdminMetrics()

  const m = q.data

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => void q.refetch()} />}
      >
        <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.handwritten, fontSize: typography.size.xl }}>
          Administrator
        </Text>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
          {profile?.display_name ?? 'Console'}
        </Text>

        {q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : !m ? (
          <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
            <Skeleton width="100%" height={96} />
            <Skeleton width="100%" height={96} />
          </View>
        ) : (
          <>
            {/* Needs attention first — these are the queues that block people. */}
            <Text style={sectionTitle(t)}>Needs attention</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Stat
                label="Applications"
                value={m.applications_pending}
                tone={m.applications_pending > 0 ? 'warn' : 'ok'}
                onPress={() => router.push('/admin/verification')}
              />
              <Stat
                label="Open reports"
                value={m.open_reports}
                tone={m.open_reports > 0 ? 'danger' : 'ok'}
                onPress={() => router.push('/admin/moderation')}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
              <Stat
                label="Disputes"
                value={m.open_disputes}
                tone={m.open_disputes > 0 ? 'danger' : 'ok'}
                onPress={() => router.push('/admin/moderation')}
              />
              <Stat
                label="Tickets"
                value={m.open_tickets}
                tone={m.open_tickets > 0 ? 'warn' : 'ok'}
                onPress={() => router.push('/admin/moderation')}
              />
            </View>

            <Text style={sectionTitle(t)}>Marketplace</Text>
            <Card style={{ marginBottom: spacing.sm }}>
              <Row label="Gross volume (30 days)" value={fmtMoney(m.gmv_30d_minor)} />
              <Row label="Commission earned (30 days)" value={fmtMoney(m.commission_30d_minor)} />
              <Row label="Payouts pending" value={fmtMoney(m.payouts_pending_minor)} />
            </Card>
            <Card style={{ marginBottom: spacing.sm }}>
              <Row label="Bookings" value={String(m.bookings_total)} />
              <Row label="Verified providers" value={`${m.providers_verified} verified · ${m.providers_published} live`} />
              <Row label="Accounts" value={`${m.users_total} total`} />
            </Card>

            <Text style={sectionTitle(t)}>People</Text>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Stat label="Clients" value={m.clients} tone="ok" />
              <Stat label="Providers" value={m.providers} tone="ok" />
              <Stat label="Admins" value={m.admins} tone="ok" />
            </View>

            {Object.keys(m.bookings_by_status ?? {}).length > 0 ? (
              <>
                <Text style={sectionTitle(t)}>Bookings by status</Text>
                <Card>
                  {Object.entries(m.bookings_by_status).map(([status, count]) => (
                    <Row key={status} label={status.replace(/_/g, ' ')} value={String(count)} />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function sectionTitle(t: ReturnType<typeof useTheme>) {
  return {
    color: t.text,
    fontFamily: typography.fontFamily.bold,
    fontSize: typography.size.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  }
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTheme()
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs, gap: spacing.md }}>
      <Text style={{ color: t.textMuted, fontSize: typography.size.sm, textTransform: 'capitalize' }}>{label}</Text>
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm }}>{value}</Text>
    </View>
  )
}

function Stat({
  label,
  value,
  tone,
  onPress,
}: {
  label: string
  value: number
  tone: 'ok' | 'warn' | 'danger'
  onPress?: () => void
}) {
  const t = useTheme()
  const color = tone === 'danger' ? t.error : tone === 'warn' ? t.warning : t.primaryDark
  return (
    <Card style={{ flex: 1 }} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        <Text style={{ color, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{value}</Text>
        {onPress ? <Ionicons name="chevron-forward" size={14} color={t.textMuted} /> : null}
      </View>
      <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 2 }}>{label}</Text>
    </Card>
  )
}
