import React from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Avatar, Card } from '../../../src/components/ui'
import { spacing, typography, useTheme } from '../../../src/theme'
import { useSession } from '../../../src/stores/session'
import { requireSupabase } from '../../../src/lib/supabase'

export default function ProfileScreen() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const isProvider = useSession((s) => s.isProvider)

  const signOut = async () => {
    const sb = requireSupabase()
    await sb.auth.signOut()
    useSession.getState().signOut()
    router.replace('/(auth)/welcome')
  }

  const items: { icon: keyof typeof Ionicons.glyphMap; label: string; route: string }[] = [
    { icon: 'heart-outline', label: 'Saved providers', route: '/favourites' },
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
          {isProvider ? (
            <View style={{ marginTop: spacing.sm }}>
              <Ionicons name="ribbon" size={18} color={t.premium} />
            </View>
          ) : null}
        </View>

        {isProvider ? (
          <Card style={{ marginBottom: spacing.lg, backgroundColor: t.premium }} onPress={() => router.push('/(provider)/dashboard')}>
            <Text style={{ color: '#FFF1E8', fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
              Provider dashboard
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
