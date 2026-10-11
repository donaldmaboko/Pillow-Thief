import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeader, StatusPill } from '../../../src/components/ui'
import { ProviderCard } from '../../../src/components/ProviderCard'
import { spacing, typography, useTheme } from '../../../src/theme'
import { useDiscovery, useMyBookings } from '../../../src/lib/queries'
import { useSession } from '../../../src/stores/session'
import { fmtDateTime } from '../../../src/lib/format'

export default function Home() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const discovery = useDiscovery({ sortBy: 'rating' })
  const bookings = useMyBookings(['confirmed', 'pending_approval', 'pending_payment', 'in_progress'])

  const upcoming = (bookings.data ?? []).filter((b) => new Date(b.starts_at) > new Date()).slice(0, 1)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
        {/* Brand header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg }}>
          <View>
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.handwritten, fontSize: typography.size.xxl }}>
              Pillow Thief
            </Text>
            <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>Steal a cuddle. Keep the comfort.</Text>
          </View>
          <Link href="/notifications">
            <Ionicons name="notifications-outline" size={24} color={t.text} />
          </Link>
        </View>

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.xs }}>
          Hi {profile?.display_name?.split(' ')[0] ?? 'there'} 👋
        </Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.md, marginBottom: spacing.lg }}>
          Real people. Genuine connection. Just cuddles.
        </Text>

        <Button title="Find a Cuddle" icon="heart" onPress={() => router.push('/(app)/(tabs)/explore')} style={{ marginBottom: spacing.lg }} />

        {/* Upcoming booking */}
        {upcoming.length > 0 ? (
          <Card style={{ marginBottom: spacing.lg }} onPress={() => router.push({ pathname: '/booking/[id]', params: { id: upcoming[0].id } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: t.textMuted, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 1 }}>Next session</Text>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
                  {upcoming[0].provider_profiles?.display_name ?? 'Your provider'}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{fmtDateTime(upcoming[0].starts_at)}</Text>
              </View>
              <StatusPill status={upcoming[0].status} />
            </View>
          </Card>
        ) : null}

        {/* Featured verified providers */}
        <SectionHeader title="Verified providers" action="See all" onAction={() => router.push('/(app)/(tabs)/explore')} />
        {discovery.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : discovery.isError ? (
          <ErrorState message="We couldn't load providers right now." onRetry={() => discovery.refetch()} />
        ) : (discovery.data ?? []).length === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No providers yet"
            body="Verified cuddle providers will appear here once they're approved in Gaborone."
          />
        ) : (
          (discovery.data ?? []).slice(0, 3).map((p) => <ProviderCard key={p.provider_id} provider={p} />)
        )}

        {/* Become a provider */}
        <Card style={{ marginTop: spacing.lg, backgroundColor: t.premium }}>
          <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.xs }}>
            Share the comfort
          </Text>
          <Text style={{ color: '#E6D2C2', fontSize: typography.size.sm, marginBottom: spacing.md, lineHeight: 20 }}>
            Professional cuddlers in Gaborone: apply, get verified, set your own prices and hours.
          </Text>
          <Button title="Become a Cuddle Provider" variant="primary" onPress={() => router.push('/(provider)/apply')} />
        </Card>

        {/* Help & safety */}
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <Card style={{ flex: 1 }} onPress={() => router.push('/safety')}>
            <Ionicons name="shield-checkmark-outline" size={22} color={t.success} />
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginTop: spacing.xs }}>Safety centre</Text>
          </Card>
          <Card style={{ flex: 1 }} onPress={() => router.push('/help')}>
            <Ionicons name="help-circle-outline" size={22} color={t.primaryDark} />
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginTop: spacing.xs }}>Help & support</Text>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
