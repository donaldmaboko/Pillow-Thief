import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, Button, Card, CardSkeleton, EmptyState, ErrorState, SectionHeader } from '../src/components/ui'
import { useMatches, useWhoLikedMe } from '../src/features/matches/useMatches'
import { useSwipe } from '../src/features/swipe/useSwipe'
import { errorMessage } from '../src/lib/api'
import { spacing, typography, useTheme } from '../src/theme'
import { useSession } from '../src/stores/session'

export default function MatchesScreen() {
  const t = useTheme()
  const router = useRouter()
  const qc = useQueryClient()
  const role = useSession((s) => s.role)
  // Providers have no deck (discovery only ever returns providers), so their
  // route into a match is the inbound like list above — never "go swipe".
  const isProvider = role === 'provider'

  const matches = useMatches()
  const likes = useWhoLikedMe()
  const swipe = useSwipe()

  const likeBack = async (actorId: string) => {
    try {
      const result = await swipe.mutateAsync({ targetId: actorId, direction: 'like' })
      void qc.invalidateQueries({ queryKey: ['matches'] })
      void qc.invalidateQueries({ queryKey: ['who-liked-me'] })
      if (result?.conversation_id) {
        router.push({ pathname: '/chat/[conversationId]', params: { conversationId: result.conversation_id } })
      }
    } catch (err) {
      Alert.alert('Could not like back', errorMessage(err))
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>Your matches</Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4 }}>
          A match only appears once you have both liked each other.
        </Text>

        {(likes.data?.length ?? 0) > 0 ? (
          <>
            <SectionHeader title="Liked you" />
            {likes.data?.map((like) => (
              <Card key={like.actor_id} style={{ marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Avatar uri={like.avatar_url} name={like.display_name} size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>
                      {like.display_name}
                    </Text>
                    <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{like.city ?? 'Nearby'}</Text>
                  </View>
                  <Button title="Like back" variant="secondary" onPress={() => void likeBack(like.actor_id)} />
                </View>
              </Card>
            ))}
          </>
        ) : null}

        <SectionHeader title="Matched" />
        {matches.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : matches.isError ? (
          <ErrorState message={errorMessage(matches.error)} onRetry={() => void matches.refetch()} />
        ) : (matches.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon="heart-outline"
            title="No matches yet"
            body={
              isProvider
                ? 'When a client likes you they appear under “Liked you” above. Like them back and you can start chatting straight away.'
                : 'Swipe on the Cuddle deck. When someone likes you back you can start chatting straight away.'
            }
            action={isProvider ? 'Back to your studio' : 'Open the deck'}
            onAction={() =>
              isProvider ? router.replace('/(provider)/dashboard') : router.replace('/(app)/(tabs)/deck')
            }
          />
        ) : (
          matches.data?.map((m) => (
            <Card
              key={m.match_id}
              style={{ marginBottom: spacing.sm }}
              onPress={() => {
                if (!m.conversation_id) return
                router.push({ pathname: '/chat/[conversationId]', params: { conversationId: m.conversation_id } })
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Avatar uri={m.avatar_url} name={m.display_name} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>
                    {m.display_name}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
                    Matched {new Date(m.matched_at).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={t.primaryDark} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
