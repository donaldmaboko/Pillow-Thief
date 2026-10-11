import React, { useState } from 'react'
import { Alert, ScrollView, Switch, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Card } from '../src/components/ui'
import { spacing, typography, useTheme } from '../src/theme'
import { requireSupabase } from '../src/lib/supabase'
import { useSession } from '../src/stores/session'
import { errorMessage } from '../src/lib/api'

export default function SettingsScreen() {
  const t = useTheme()
  const router = useRouter()
  const profile = useSession((s) => s.profile)
  const [notifyBookings, setNotifyBookings] = useState(profile?.notify_booking_updates ?? true)
  const [notifyMessages, setNotifyMessages] = useState(profile?.notify_messages ?? true)
  const [notifyPromos, setNotifyPromos] = useState(profile?.notify_promotions ?? false)
  const [saving, setSaving] = useState(false)

  const persist = async (patch: Record<string, boolean>) => {
    setSaving(true)
    try {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      const { error } = await sb.from('profiles').update(patch).eq('id', uid)
      if (error) throw error
    } catch (err) {
      Alert.alert('Could not save', errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const Row = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm }}>
      <Text style={{ color: t.text, fontSize: typography.size.md }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => { onChange(v) }}
        trackColor={{ false: t.border, true: t.primary }}
        thumbColor={t.white}
      />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Account settings' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.sm }}>
          Notifications
        </Text>
        <Card style={{ marginBottom: spacing.lg }}>
          <Row label="Booking updates" value={notifyBookings} onChange={(v) => { setNotifyBookings(v); persist({ notify_booking_updates: v }) }} />
          <Row label="New messages" value={notifyMessages} onChange={(v) => { setNotifyMessages(v); persist({ notify_messages: v }) }} />
          <Row label="Offers & news" value={notifyPromos} onChange={(v) => { setNotifyPromos(v); persist({ notify_promotions: v }) }} />
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs }}>
            Essential account, payment and safety notices are always delivered.
          </Text>
        </Card>

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.sm }}>
          Privacy
        </Text>
        <Card style={{ marginBottom: spacing.lg }} onPress={() => router.push('/settings/privacy')}>
          <Text style={{ color: t.text, fontSize: typography.size.md }}>Privacy settings</Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 2 }}>Trusted contact, location, data</Text>
        </Card>

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.sm }}>
          Account
        </Text>
        <Card style={{ marginBottom: spacing.sm }} onPress={() => router.push('/settings/delete')}>
          <Text style={{ color: t.error, fontSize: typography.size.md }}>Delete my account</Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 2 }}>Deactivates your profile and queues permanent deletion</Text>
        </Card>

        <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.lg, textAlign: 'center' }}>
          Pillow Thief v0.1.0 · Gaborone, Botswana · BWP
        </Text>
      </ScrollView>
    </View>
  )
}
