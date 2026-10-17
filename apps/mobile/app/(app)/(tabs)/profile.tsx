import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { ROLE_LABELS } from '@pillow-thief/shared'
import { Avatar, Card } from '../../../src/components/ui'
import { spacing, typography, useTheme } from '../../../src/theme'
import { useSession } from '../../../src/stores/session'
import { requireSupabase } from '../../../src/lib/supabase'

export default function ProfileScreen() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const isProvider = useSession((s) => s.isProvider)
  const isAdmin = useSession((s) => s.isAdmin)
  const role = useSession((s) => s.role)

  const signOut = async () => {
    const sb = requireSupabase()
    await sb.auth.signOut()
    useSession.getState().signOut()
    router.replace('/(auth)/welcome')
  }

  const items: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
    { icon: 'heart-outline', label: 'Your matches', route: '/matches' },
    { icon: 'bookmark-outline', label: 'Saved providers', route: '/favourites' },
    { icon: 'card-outline', label: 'Payment history', route: '/payments' },
    { icon: 'notifications-outline', label: 'Notifications', route: '/notifications' },
    { icon: 'shield-checkmark-outline', label: 'Safety centre', route: '/safety' },
    { icon: 'help-circle-outline', label: 'Help & support', route: '/help' },
    { icon: 'settings-outline', label: 'Account settings', route: '/settings' },
  ]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
          <Avatar uri={profile?.avatar_url} name={profile?.display_name ?? 'You'} size={88} />
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginTop: spacing.md }}>
            {profile?.display_name ?? 'Your account'}
          </Text>
          {role ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
              <Ionicons
                name={isAdmin ? 'shield' : isProvider ? 'ribbon' : 'person'}
                size={16}
                color={isAdmin ? t.error : isProvider ? t.premium : t.textMuted}
              />
              <Text
                style={{
                  color: isAdmin ? t.error : isProvider ? t.premium : t.textMuted,
                  fontFamily: typography.fontFamily.semibold,
                  fontSize: typography.size.sm,
                }}
              >
                {ROLE_LABELS[role]}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Admins get their own console; providers get the studio. Neither sees
            the other's entry card. */}
        {isAdmin ? (
          <Card
            style={{ marginBottom: spacing.lg, backgroundColor: t.error }}
            onPress={() => router.push('/admin')}
          >
            <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
              Admin console
            </Text>
            <Text style={{ color: '#F6DADA', fontSize: typography.size.sm, marginTop: 4 }}>
              Verification queue, moderation and platform settings →
            </Text>
          </Card>
        ) : null}

        {isProvider ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: t.premium }} onPress={() => router.push('/(provider)/dashboard')}>
            <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
              Provider studio
            </Text>
            <Text style={{ color: '#E6D2C2', fontSize: typography.size.sm, marginTop: 4 }}>
              Manage requests, availability, services and earnings →
            </Text>
          </Card>
        ) : null}

        {items.map((item) => (
          <Card key={item.label} style={{ marginBottom: spacing.sm }} onPress={() => router.push(item.route as never)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name={item.icon} size={20} color={t.primaryDark} />
              <Text style={{ flex: 1, color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md }}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={t.textMuted} />
            </View>
          </Card>
        ))}

        <Card style={{ marginTop: spacing.md }} onPress={() => signOut()}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="log-out-outline" size={20} color={t.error} />
            <Text style={{ color: t.error, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md }}>Sign out</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  )
}
