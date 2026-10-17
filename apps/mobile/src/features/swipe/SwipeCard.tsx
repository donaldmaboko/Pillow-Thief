import React from 'react'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import type { DeckCard } from '@pillow-thief/shared'
import { RatingStars, VerifiedBadge } from '../../components/ui'
import { fmtMoney } from '../../lib/format'
import { radius, shadows, spacing, typography, useTheme } from '../../theme'

/**
 * Presentational deck card. No gesture logic here — SwipeDeck owns that so the
 * card stays cheap to re-render while the stack animates.
 */
export function SwipeCard({ card, style, height }: { card: DeckCard; style?: StyleProp<ViewStyle>; height: number }) {
  const t = useTheme()
  const distance = card.distance_km == null ? null : card.distance_km < 1 ? 'less than 1 km' : `${card.distance_km} km away`

  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          overflow: 'hidden',
          ...shadows.card,
        },
        style,
      ]}
    >
      <View style={{ height: height * 0.58, backgroundColor: t.surfaceMuted }}>
        {card.avatar_url ? (
          <Image source={{ uri: card.avatar_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={200} />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="person" size={72} color={t.textMuted} />
          </View>
        )}
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Text
            numberOfLines={1}
            style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, flexShrink: 1 }}
          >
            {card.display_name}
          </Text>
          {card.verification === 'verified' ? <VerifiedBadge small /> : null}
        </View>

        {card.headline ? (
          <Text numberOfLines={2} style={{ color: t.text, fontSize: typography.size.md, lineHeight: 21 }}>
            {card.headline}
          </Text>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 }}>
          <Ionicons name="location-outline" size={14} color={t.textMuted} />
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
            {[card.neighbourhood, card.city].filter(Boolean).join(', ') || 'Location not set'}
            {distance ? ` · ${distance}` : ''}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
          <RatingStars rating={card.avg_rating} count={card.review_count} />
          {card.starting_price_minor != null ? (
            <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>
              from {fmtMoney(card.starting_price_minor)}
            </Text>
          ) : null}
        </View>

        {card.instant_booking ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs }}>
            <Ionicons name="flash" size={13} color={t.premium} />
            <Text style={{ color: t.premium, fontSize: typography.size.xs, fontFamily: typography.fontFamily.semibold }}>
              Instant booking
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}
