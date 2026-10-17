import React, { useCallback, useEffect, useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import * as Location from 'expo-location'
import type { DeckCard, SwipeDirection } from '@pillow-thief/shared'
import { Ionicons } from '@expo/vector-icons'
import { SwipeDeck } from '../../../src/features/swipe/SwipeDeck'
import { useDeck, type Coords } from '../../../src/features/swipe/useDeck'
import { useSwipe } from '../../../src/features/swipe/useSwipe'
import { useMatchesRealtime, useWhoLikedMe } from '../../../src/features/matches/useMatches'
import { Button, CardSkeleton, EmptyState, ErrorState } from '../../../src/components/ui'
import { errorMessage } from '../../../src/lib/api'
import { spacing, typography, useTheme } from '../../../src/theme'

export default function DeckScreen() {
  const t = useTheme()
  const router = useRouter()
  const qc = useQueryClient()

  const [coords, setCoords] = useState<Coords | null>(null)
  const [locationNote, setLocationNote] = useState<string | null>(null)
  // Cards the user has swiped this session, removed optimistically for instant
  // feedback. The server is still the source of truth.
  const [handled, setHandled] = useState<string[]>([])

  const deck = useDeck(coords)
  const swipe = useSwipe()
  const likes = useWhoLikedMe()
  useMatchesRealtime()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        if (status !== 'granted') {
          if (!cancelled) setLocationNote('Location off — showing the best-rated providers instead.')
          return
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        if (!cancelled) setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      } catch {
        if (!cancelled) setLocationNote('Location unavailable — showing the best-rated providers instead.')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const cards = (deck.data ?? []).filter((c) => !handled.includes(c.provider_id))
  const likeCount = likes.data?.length ?? 0

  const onSwipe = useCallback(
    async (card: DeckCard, direction: SwipeDirection) => {
      setHandled((prev) => [...prev, card.provider_id])
      try {
        const result = await swipe.mutateAsync({ targetId: card.provider_id, direction })
        if (result?.matched) {
          void qc.invalidateQueries({ queryKey: ['matches'] })
          void qc.invalidateQueries({ queryKey: ['who-liked-me'] })
          Alert.alert('It’s a match', `You and ${card.display_name} liked each other.`, [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Say hello',
              onPress: () => {
                if (result.conversation_id) {
                  router.push({ pathname: '/chat/[conversationId]', params: { conversationId: result.conversation_id } })
                } else {
                  router.push('/matches')
                }
              },
            },
          ])
        }
      } catch (err) {
        // Put the card back so nothing is silently lost.
        setHandled((prev) => prev.filter((id) => id !== card.provider_id))
        Alert.alert('Could not save that swipe', errorMessage(err))
      }
    },
    [qc, router, swipe],
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View>
          <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.handwritten, fontSize: typography.size.xl }}>
            Cuddle
          </Text>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
            Find a cuddle
          </Text>
        </View>
        <Button
          title={likeCount > 0 ? `Likes ${likeCount}` : 'Matches'}
          variant="secondary"
          icon="heart-outline"
          onPress={() => router.push('/matches')}
        />
      </View>

      {locationNote && !coords ? (
        <Text style={{ color: t.textMuted, fontSize: typography.size.xs, paddingHorizontal: spacing.lg, marginTop: spacing.xs }}>
          {locationNote}
        </Text>
      ) : null}

      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        {deck.isLoading ? (
          <View style={{ gap: spacing.md }}>
            <CardSkeleton />
            <CardSkeleton />
          </View>
        ) : deck.isError ? (
          <ErrorState message={errorMessage(deck.error)} onRetry={() => void deck.refetch()} />
        ) : cards.length === 0 ? (
          <EmptyState
            icon="moon-outline"
            title="That’s everyone for now"
            body="You’ve seen every verified provider nearby. Widen the area on the map, or check back when new providers join."
            action="Refresh"
            onAction={() => {
              setHandled([])
              void deck.refetch()
            }}
          />
        ) : (
          <SwipeDeck cards={cards} onSwipe={onSwipe} />
        )}
      </View>
    </SafeAreaView>
  )
}
