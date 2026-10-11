import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Card, EmptyState, ErrorState, RatingStars } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'

export default function ProviderReviews() {
  const t = useTheme()
  const userId = useSession((s) => s.userId)

  const q = useQuery({
    queryKey: ['provider-reviews', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb
        .from('reviews')
        .select('*')
        .eq('provider_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Reviews' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={<>
          q.isLoading ? null : q.isError ? (
            <ErrorState message="Couldn't load reviews." onRetry={() => q.refetch()} />
          ) : (
            <EmptyState icon="star-outline" title="No reviews yet" body="Genuine reviews from completed sessions appear here." />
          )
        </>
        }
        renderItem={({ item }) => (
          <Card style={{ marginBottom: spacing.md }}>
            <RatingStars rating={item.rating} size={16} />
            {item.body ? <Text style={{ color: t.text, fontSize: typography.size.sm, marginTop: spacing.sm, lineHeight: 20 }}>{item.body}</Text> : null}
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.sm }}>
              {new Date(item.created_at).toLocaleDateString('en-BW', { timeZone: 'Africa/Gaborone' })}
            </Text>
            {item.provider_response ? (
              <View style={{ backgroundColor: t.surfaceMuted, borderRadius: 12, padding: spacing.md, marginTop: spacing.sm }}>
                <Text style={{ color: t.textMuted, fontSize: typography.size.xs }}>Your response</Text>
                <Text style={{ color: t.text, fontSize: typography.size.sm, marginTop: 2 }}>{item.provider_response}</Text>
              </View>
            ) : (
              <Text style={{ color: t.primaryDark, fontSize: typography.size.sm, marginTop: spacing.sm }}>Tap to respond</Text>
            )}
          </Card>
        )}
      />
    </View>
  )
}
