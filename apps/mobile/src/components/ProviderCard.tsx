import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { radius, shadows, spacing, typography, useTheme } from '../theme'
import { fmtMoney, fmtDuration } from '../lib/format'
import { RatingStars, VerifiedBadge } from './ui'
import type { DiscoveryProvider } from '../lib/queries'
import { MEETING_ARRANGEMENT_LABELS, type MeetingArrangement } from '@pillow-thief/shared'

export function ProviderCard({ provider }: { provider: DiscoveryProvider }) {
  const t = useTheme()
  const router = useRouter()
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/provider/[id]', params: { id: provider.provider_id } })}
      style={({ pressed }) => [
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          padding: spacing.lg,
          ...shadows.card,
          opacity: pressed ? 0.9 : 1,
          marginBottom: spacing.md,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <AvatarImage uri={provider.avatar_url} name={provider.display_name} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
              {provider.display_name}
            </Text>
            <VerifiedBadge small />
          </View>
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
            <Ionicons name="location" size={12} color={t.textMuted} /> {provider.neighbourhood ?? provider.city}
          </Text>
          {provider.headline ? (
            <Text numberOfLines={1} style={{ color: t.text, fontSize: typography.size.sm }}>
              {provider.headline}
            </Text>
          ) : null}
          <RatingStars rating={provider.avg_rating} count={provider.review_count} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>
              {provider.starting_price_minor != null
                ? `from ${fmtMoney(provider.starting_price_minor)}`
                : 'Contact for pricing'}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', flexShrink: 1 }}>
              {provider.durations.slice(0, 3).map((d) => (
                <View key={d} style={{ backgroundColor: t.surfaceMuted, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>{fmtDuration(d)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs, flexWrap: 'wrap' }}>
            {provider.accepts.map((a) => (
              <View key={a} style={{ backgroundColor: `${t.primary}22`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: t.primaryDark, fontSize: typography.size.xs }}>
                  {MEETING_ARRANGEMENT_LABELS[a as MeetingArrangement] ?? a}
                </Text>
              </View>
            ))}
            {provider.instant_booking ? (
              <View style={{ backgroundColor: `${t.success}22`, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: t.success, fontSize: typography.size.xs }}>⚡ Instant</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  )
}

function AvatarImage({ uri, name }: { uri: string | null; name: string }) {
  const t = useTheme()
  if (!uri) {
    const initials = name
      .split(' ')
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
    return (
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.beige, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: t.premium, fontFamily: typography.fontFamily.bold, fontSize: 22 }}>{initials}</Text>
      </View>
    )
  }
  const { Image } = require('expo-image')
  return <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 32 }} contentFit="cover" />
}
