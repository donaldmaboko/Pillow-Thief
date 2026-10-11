import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, EmptyState, ErrorState } from '../src/components/ui'
import { radius, spacing, typography, useTheme } from '../src/theme'
import { useMarkNotificationsRead, useNotifications } from '../src/lib/queries'

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'booking.requested': 'calendar-outline',
  'booking.confirmed': 'checkmark-circle-outline',
  'booking.declined': 'close-circle-outline',
  'booking.cancelled': 'trash-outline',
  'booking.completed': 'heart',
  'booking.disputed': 'warning-outline',
  'verification.approved': 'ribbon-outline',
  'verification.rejected': 'close-circle-outline',
  'verification.update': 'information-circle-outline',
}

export default function NotificationsScreen() {
  const t = useTheme()
  const q = useNotifications()
  const markRead = useMarkNotificationsRead()

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Notifications' }} />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListHeaderComponent={
          <>
            {(q.data ?? []).some((n) => !n.read_at) ? (
              <Button title="Mark all as read" variant="secondary" loading={markRead.isPending} onPress={() => markRead.mutate()} style={{ marginBottom: spacing.md }} />
            ) : null}
          </>
        }
        ListEmptyComponent={
          <>
            {q.isLoading ? null : q.isError ? (
              <ErrorState message="Couldn't load notifications." onRetry={() => q.refetch()} />
            ) : (
              <EmptyState icon="notifications-outline" title="All caught up" body="Booking updates, messages and verification news will land here." />
            )}
          </>
        }
        renderItem={({ item }) => (
          <View
            style={{
              backgroundColor: item.read_at ? t.surface : `${t.primary}14`,
              borderRadius: radius.lg,
              padding: spacing.lg,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              gap: spacing.md,
            }}
          >
            <Ionicons name={ICONS[item.kind] ?? 'notifications-outline'} size={22} color={item.read_at ? t.textMuted : t.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>{item.title}</Text>
              {item.body ? <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 2, lineHeight: 20 }}>{item.body}</Text> : null}
              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: 4 }}>
                {new Date(item.created_at).toLocaleString('en-BW', { timeZone: 'Africa/Gaborone' })}
              </Text>
            </View>
          </View>
        )}
      />
    </View>
  )
}
