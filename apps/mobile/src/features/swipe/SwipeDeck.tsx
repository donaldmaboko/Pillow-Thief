import React, { useCallback, useMemo, useRef } from 'react'
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import type { DeckCard, SwipeDirection } from '@pillow-thief/shared'
import { SwipeCard } from './SwipeCard'
import { radius, spacing, typography, useTheme } from '../../theme'

const SWIPE_X_THRESHOLD = 110
const SWIPE_UP_THRESHOLD = 120
const CARD_ASPECT = 1.42

/**
 * The card stack. Reads `cards` from the parent and always animates cards[0].
 * A completed gesture calls `onSwipe`; the parent decides what happens next, so
 * there is a single source of truth for deck state.
 */
export function SwipeDeck({
  cards,
  onSwipe,
  disabled = false,
}: {
  cards: DeckCard[]
  onSwipe: (card: DeckCard, direction: SwipeDirection) => void
  disabled?: boolean
}) {
  const t = useTheme()
  const { width, height } = useWindowDimensions()
  const position = useRef(new Animated.ValueXY()).current
  const busy = useRef(false)

  const cardWidth = Math.min(width - spacing.lg * 2, 460)
  const cardHeight = Math.min(cardWidth * CARD_ASPECT, height * 0.62)

  const topCard = cards[0]

  const commit = useCallback(
    (card: DeckCard, direction: SwipeDirection) => {
      if (busy.current) return
      busy.current = true
      Haptics.impactAsync(
        direction === 'pass' ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
      ).catch(() => {})

      const toX = direction === 'pass' ? -width * 1.5 : width * 1.5
      const toY = direction === 'super_like' ? -height * 1.1 : 0

      Animated.timing(position, {
        toValue: { x: toX, y: toY },
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        position.setValue({ x: 0, y: 0 })
        busy.current = false
        onSwipe(card, direction)
      })
    },
    [height, onSwipe, position, width],
  )

  // Keep the gesture handlers pointing at the latest callback without
  // recreating the PanResponder (which would drop an in-flight gesture).
  const commitRef = useRef(commit)
  commitRef.current = commit
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled
  const cardsRef = useRef(cards)
  cardsRef.current = cards

  const responder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_: GestureResponderEvent, g: PanResponderGestureState) =>
          !disabledRef.current && (Math.abs(g.dx) > 8 || Math.abs(g.dy) > 12),
        onPanResponderMove: (_: GestureResponderEvent, g: PanResponderGestureState) => {
          position.setValue({ x: g.dx, y: g.dy })
        },
        onPanResponderRelease: (_: GestureResponderEvent, g: PanResponderGestureState) => {
          const top = cardsRef.current[0]
          if (!top) return
          if (g.dy < -SWIPE_UP_THRESHOLD && Math.abs(g.dx) < 80) {
            commitRef.current(top, 'super_like')
            return
          }
          if (g.dx > SWIPE_X_THRESHOLD) {
            commitRef.current(top, 'like')
            return
          }
          if (g.dx < -SWIPE_X_THRESHOLD) {
            commitRef.current(top, 'pass')
            return
          }
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 6,
          }).start()
        },
      }),
    [position],
  )

  const rotate = position.x.interpolate({
    inputRange: [-width / 2, 0, width / 2],
    outputRange: ['-9deg', '0deg', '9deg'],
    extrapolate: 'clamp',
  })

  const likeOpacity = position.x.interpolate({ inputRange: [0, SWIPE_X_THRESHOLD], outputRange: [0, 1], extrapolate: 'clamp' })
  const passOpacity = position.x.interpolate({ inputRange: [-SWIPE_X_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })
  const superOpacity = position.y.interpolate({ inputRange: [-SWIPE_UP_THRESHOLD, 0], outputRange: [1, 0], extrapolate: 'clamp' })

  const visible = cards.slice(0, 3)

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {visible
          .map((card, i) => ({ card, i }))
          .reverse()
          .map(({ card, i }) => {
            const isTop = i === 0
            const stacked = {
              transform: [{ scale: 1 - i * 0.04 }, { translateY: i * 12 }],
            }
            const dragging = {
              transform: [...position.getTranslateTransform(), { rotate }],
            }
            return (
              <Animated.View
                key={card.provider_id}
                style={[
                  {
                    position: 'absolute',
                    width: cardWidth,
                    height: cardHeight,
                    zIndex: 10 - i,
                  },
                  isTop ? dragging : stacked,
                ]}
                {...(isTop ? responder.panHandlers : {})}
              >
                <SwipeCard card={card} height={cardHeight} style={{ width: cardWidth, height: cardHeight }} />

                {isTop && topCard ? (
                  <>
                    <Animated.View style={[overlayStyle(t, t.success, 'like'), { opacity: likeOpacity }]}>
                      <Text style={overlayText(t.success)}>LIKE</Text>
                    </Animated.View>
                    <Animated.View style={[overlayStyle(t, t.error, 'pass'), { opacity: passOpacity }]}>
                      <Text style={overlayText(t.error)}>PASS</Text>
                    </Animated.View>
                    <Animated.View style={[overlayStyle(t, t.premium, 'super'), { opacity: superOpacity }]}>
                      <Text style={overlayText(t.premium)}>SUPER</Text>
                    </Animated.View>
                  </>
                ) : null}
              </Animated.View>
            )
          })}
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.lg }}>
        <DeckButton
          icon="close"
          color={t.error}
          label="Pass"
          disabled={disabled || !topCard}
          onPress={() => topCard && commit(topCard, 'pass')}
        />
        <DeckButton
          icon="star"
          color={t.premium}
          label="Super like"
          small
          disabled={disabled || !topCard}
          onPress={() => topCard && commit(topCard, 'super_like')}
        />
        <DeckButton
          icon="heart"
          color={t.success}
          label="Like"
          disabled={disabled || !topCard}
          onPress={() => topCard && commit(topCard, 'like')}
        />
      </View>
    </View>
  )
}

function overlayStyle(t: ReturnType<typeof useTheme>, color: string, side: 'like' | 'pass' | 'super') {
  return {
    position: 'absolute' as const,
    top: side === 'super' ? 20 : 24,
    left: side === 'like' ? 20 : undefined,
    right: side === 'pass' ? 20 : undefined,
    alignSelf: side === 'super' ? ('center' as const) : undefined,
    borderWidth: 4,
    borderColor: color,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: `${t.surface}CC`,
  }
}

function overlayText(color: string) {
  return { color, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xl, letterSpacing: 2 }
}

function DeckButton({
  icon,
  color,
  label,
  onPress,
  disabled,
  small = false,
}: {
  icon: keyof typeof Ionicons.glyphMap
  color: string
  label: string
  onPress: () => void
  disabled?: boolean
  small?: boolean
}) {
  const t = useTheme()
  const size = small ? 52 : 68
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.surface,
        borderWidth: 2,
        borderColor: disabled ? t.border : color,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon} size={small ? 22 : 30} color={color} />
    </Pressable>
  )
}
