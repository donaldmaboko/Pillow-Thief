import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, EmptyState, RatingStars, StatusPill } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { useSession } from '../../src/stores/session'
import { useQuery } from '@tanstack/react-query'
import { requireSupabase } from '../../src/lib/supabase'
import { fmtDateTime, fmtDuration, fmtMoney } from '../../src/lib/format'
import { BOOKING_STATUS_LABELS, type BookingStatus } from '@pillow-thief/shared'

export default function ProviderDashboard() {
  const t = useTheme()
  const router = useRouter()
  const userId = useSession((s) => s.userId)

  const q = useQuery({
    queryKey: ['provider-dashboard', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = requireSupabase()
      const [{ data: providerProfile }, { data: bookings }, { data: earnings }, { data: reviews }, { data: application }] =
        await Promise.all([
          sb.from('provider_profiles').select('*').eq('provider_id', userId!).maybeSingle(),
          sb
            .from('bookings')
            .select('*, provider_services(title), profiles!bookings_client_id_fkey(display_name)')
            .eq('provider_id', userId!)
            .order('starts_at', { ascending: true })
            .limit(30),
          sb.from('provider_payouts').select('*').eq('provider_id', userId!).order('period_end', { ascending: false }).limit(6),
          sb.from('reviews').select('id, rating, body, created_at').eq('provider_id', userId!).eq('status', 'published').order('created_at', { ascending: false }).limit(3),
          sb.from('provider_applications').select('status').eq('user_id', userId!).maybeSingle(),
        ])
      return { providerProfile, bookings: bookings ?? [], earnings: earnings ?? [], reviews: reviews ?? [], applicationStatus: application?.status }
    },
  })

  const data = q.data
  const pp = data?.providerProfile
  const now = new Date()
  const today = (data?.bookings ?? []).filter((b) => new Date(b.starts_at).toDateString() === now.toDateString() && ['confirmed', 'in_progress'].includes(b.status))
  const pending = (data?.bookings ?? []).filter((b) => b.status === 'pending_approval')
  const upcoming = (data?.bookings ?? []).filter((b) => new Date(b.starts_at) > now && ['confirmed'].includes(b.status) && new Date(b.starts_at).toDateString() !== now.toDateString())

  const earningsSummary = (data?.earnings ?? []).reduce(
    (acc, p) => ({ gross: acc.gross + p.gross_minor, net: acc.net + p.net_minor, pending: acc.pending + (p.status === 'pending' ? p.net_minor : 0) }),
    { gross: 0, net: 0, pending: 0 },
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.handwritten, fontSize: typography.size.xl }}>Provider studio</Text>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.lg }}>
          Hello {useSession.getState().profile?.display_name ?? 'provider'} 👋
        </Text>

        {/* Verification / publishing state */}
        {pp == null ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: t.premium }}>
            <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
              {data?.applicationStatus === 'pending' ? 'Application under review' : 'Finish your application'}
            </Text>
            <Text style={{ color: '#E6D2C2', fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.md }}>
              {data?.applicationStatus === 'pending'
                ? 'Our team reviews every application. You’ll be notified once verification completes.'
                : 'Apply, complete verification, and start accepting bookings.'}
            </Text>
            {data?.applicationStatus !== 'pending' ? <Button title="Open application" onPress={() => router.push('/(provider)/apply')} /> : null}
          </Card>
        ) : !pp.published ? (
          <Card style={{ marginBottom: spacing.lg }}>
            <StatusPill status={pp.verification} />
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, marginTop: spacing.sm }}>
              {pp.verification === 'verified' ? 'Verified — finish setup to publish' : 'Verification in progress'}
            </Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.md }}>
              Add services, availability and a service area, then your profile goes live in discovery.
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Services" variant="secondary" onPress={() => router.push('/(provider)/services')} style={{ flex: 1 }} />
              <Button title="Availability" variant="secondary" onPress={() => router.push('/(provider)/availability')} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : null}

        {/* Quick stats */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{pending.length}</Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>Pending requests</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{today.length}</Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>Today</Text>
          </Card>
          <Card style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{fmtMoney(earningsSummary.net)}</Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>Net earnings</Text>
          </Card>
        </View>

        {/* Pending requests */}
        {pending.length > 0 ? (
          <>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.sm }}>Awaiting your response</Text>
            {pending.map((b) => (
              <Card key={b.id} style={{ marginBottom: spacing.sm }} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>{b.provider_services?.title}</Text>
                    <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{fmtDateTime(b.starts_at)} · {fmtDuration(b.duration_min)}</Text>
                  </View>
                  <StatusPill status={b.status} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        {/* Today */}
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginVertical: spacing.sm }}>Today's sessions</Text>
        {today.length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginBottom: spacing.md }}>No confirmed sessions today.</Text>
        ) : (
          today.map((b) => (
            <Card key={b.id} style={{ marginBottom: spacing.sm }} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>{fmtDateTime(b.starts_at)}</Text>
              <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{b.provider_services?.title} · {fmtDuration(b.duration_min)}</Text>
            </Card>
          ))
        )}

        {/* Upcoming */}
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginVertical: spacing.sm }}>Upcoming</Text>
        {upcoming.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No upcoming sessions" body="New confirmed bookings appear here." />
        ) : (
          upcoming.slice(0, 5).map((b) => (
            <Card key={b.id} style={{ marginBottom: spacing.sm }} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: b.id } })}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold }}>{fmtDateTime(b.starts_at)}</Text>
              <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{b.provider_services?.title} · {fmtMoney(b.total_minor, b.currency)}</Text>
            </Card>
          ))
        )}

        {/* Management shortcuts */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg }}>
          <MgmtCard icon="pricetag-outline" label="Services & pricing" onPress={() => router.push('/(provider)/services')} />
          <MgmtCard icon="calendar-outline" label="Availability" onPress={() => router.push('/(provider)/availability')} />
          <MgmtCard icon="wallet-outline" label="Earnings & payouts" onPress={() => router.push('/(provider)/earnings')} />
          <MgmtCard icon="star-outline" label="Reviews" onPress={() => router.push('/(provider)/reviews')} />
        </View>

        {/* Rating */}
        {pp ? (
          <Card style={{ marginTop: spacing.lg }}>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, marginBottom: spacing.xs }}>Your rating</Text>
            <RatingStars rating={pp.avg_rating ?? null} count={pp.review_count} size={16} />
            {(data?.reviews ?? []).map((r) => (
              <Text key={r.id} style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: spacing.sm, lineHeight: 20 }}>
                {'★'.repeat(r.rating)} {r.body ?? ''}
              </Text>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  )
}

function MgmtCard({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Card style={{ width: '47%', marginBottom: spacing.sm }} onPress={onPress}>
      <Ionicons name={icon} size={22} color={t.primaryDark} />
      <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, marginTop: spacing.sm }}>{label}</Text>
    </Card>
  )
}
