import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, CardSkeleton, ErrorState, RatingStars, SafetyAlert, StatusPill, VerifiedBadge } from '../../src/components/ui'
import { radius, spacing, typography, useTheme } from '../../src/theme'
import { useFavourites, useProviderProfile, useProviderReviews, useToggleFavourite } from '../../src/lib/queries'
import { fmtDuration, fmtMoney } from '../../src/lib/format'
import { MEETING_ARRANGEMENT_LABELS, type MeetingArrangement } from '@pillow-thief/shared'

export default function ProviderProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const t = useTheme()
  const router = useRouter()
  const q = useProviderProfile(id)
  const reviews = useProviderReviews(id)
  const favourites = useFavourites()
  const toggleFav = useToggleFavourite()

  const isFavourite = (favourites.data ?? []).some((f) => f.provider_id === id)

  if (q.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: spacing.lg }}>
        <CardSkeleton />
        <CardSkeleton />
      </View>
    )
  }
  if (q.isError || !q.data?.discovery) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: spacing.lg }}>
        <ErrorState message="This profile is unavailable. It may have been unpublished." onRetry={() => q.refetch()} />
      </View>
    )
  }

  const p = q.data.discovery
  const services = q.data.services
  const areas = q.data.areas

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: p.display_name, headerShadowVisible: false }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <AvatarImage uri={p.avatar_url} name={p.display_name} size={84} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>{p.display_name}</Text>
            <VerifiedBadge />
            <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
              <Ionicons name="location" size={12} color={t.textMuted} /> {p.neighbourhood ?? p.city}, {p.city}
            </Text>
          </View>
        </View>

        <RatingStars rating={p.avg_rating} count={p.review_count} size={16} />

        {/* Actions row */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            title={isFavourite ? 'Saved' : 'Save'}
            variant="secondary"
            icon={isFavourite ? 'heart' : 'heart-outline'}
            loading={toggleFav.isPending}
            onPress={() => toggleFav.mutate({ providerId: p.provider_id })}
            style={{ flex: 1 }}
          />
          <Button
            title="Report"
            variant="ghost"
            icon="flag-outline"
            onPress={() =>
              Alert.alert('Report this profile', 'Reports are reviewed by our safety team. Use Help & support to submit details.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open support', onPress: () => router.push('/help') },
              ])
            }
          />
        </View>

        <Text style={{ color: t.text, fontSize: typography.size.md, lineHeight: 24, marginTop: spacing.lg }}>{p.bio_excerpt}</Text>

        <SafetyAlert
          title="All services are non-sexual"
          body="Sessions follow the agreed boundaries. Either person may pause or stop at any time."
        />

        {/* Meeting arrangements */}
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Meeting options
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(p.accepts as string[]).map((a: string) => (
            <View key={a} style={{ backgroundColor: `${t.primary}22`, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2 }}>
              <Text style={{ color: t.primaryDark, fontSize: typography.size.sm, fontFamily: typography.fontFamily.semibold }}>
                {MEETING_ARRANGEMENT_LABELS[a as MeetingArrangement] ?? a}
              </Text>
            </View>
          ))}
        </View>

        {/* Languages */}
        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: spacing.md }}>
          Speaks: {p.languages.join(', ').toUpperCase()}
        </Text>

        {/* Services */}
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Services & pricing
        </Text>
        {services.length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>No services listed yet.</Text>
        ) : (
          services.map((s) => (
            <Card key={s.id} style={{ marginBottom: spacing.md }}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>{s.title}</Text>
              <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginVertical: spacing.sm, lineHeight: 20 }}>{s.description}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                {([
                  [30, s.price_30_minor],
                  [60, s.price_60_minor],
                  [90, s.price_90_minor],
                  [120, s.price_120_minor],
                ] as [number, number | null][]).map(([dur, price]) =>
                  price != null ? (
                    <View key={dur} style={{ backgroundColor: t.surfaceMuted, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minWidth: 90 }}>
                      <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>{fmtDuration(dur)}</Text>
                      <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>{fmtMoney(price, s.currency)}</Text>
                    </View>
                  ) : null,
                )}
              </View>
            </Card>
          ))
        )}

        {/* Service areas (approximate — privacy-safe) */}
        {areas.length > 0 ? (
          <>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.lg, marginBottom: spacing.sm }}>
              House-call areas
            </Text>
            {areas.map((a) => (
              <View key={a.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                <Text style={{ color: t.text, fontSize: typography.size.md }}>
                  <Ionicons name="navigate-circle-outline" size={16} color={t.primaryDark} /> {a.name}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
                  up to {a.max_travel_km} km · base {fmtMoney(a.travel_base_fee_minor)}
                </Text>
              </View>
            ))}
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs }}>
              Exact addresses are shared only with confirmed booking participants. Travel fees are calculated by the server from road distance.
            </Text>
          </>
        ) : null}

        {/* Reviews */}
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Reviews
        </Text>
        {(reviews.data ?? []).length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>No reviews yet — genuine reviews appear after completed sessions.</Text>
        ) : (
          (reviews.data ?? []).map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.md }}>
              <RatingStars rating={r.rating} size={13} />
              {r.body ? <Text style={{ color: t.text, fontSize: typography.size.sm, marginTop: spacing.sm, lineHeight: 20 }}>{r.body}</Text> : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.border }}>
        <Button title="Book a Session" icon="heart" onPress={() => router.push({ pathname: '/booking/new/[providerId]', params: { providerId: p.provider_id } })} />
      </View>
    </View>
  )
}

function AvatarImage({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const t = useTheme()
  if (!uri) {
    const initials = name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: t.beige, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.premium, fontFamily: typography.fontFamily.bold, fontSize: size * 0.35 }}>{initials}</Text>
      </View>
    )
  }
  const { Image } = require('expo-image')
  return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
}
