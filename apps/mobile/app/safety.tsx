import React from 'react'
import { Linking, ScrollView, Text, View, Alert } from 'react-native'
import { Stack } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Card, SafetyAlert } from '../src/components/ui'
import { spacing, typography, useTheme } from '../src/theme'

export default function SafetyCentre() {
  const t = useTheme()

  const callSupport = () => {
    Alert.alert(
      'Contact support',
      'For urgent safety concerns use the in-app Help & support form — it is routed to our safety team immediately. Pillow Thief does not contact emergency services on your behalf.',
      [{ text: 'Open Help', onPress: () => {} }, { text: 'OK', style: 'cancel' }],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Safety centre' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <SafetyAlert
          title="Consent is ongoing"
          body="Either person may pause or end a session at any time, for any reason, without penalty. Your boundaries are agreed in the pre-session checklist."
        />

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          Safety tools
        </Text>

        <SafetyCard icon="flag-outline" title="Report a user or session" body="Opens a confidential report reviewed by our safety team. You can report sexual solicitation, harassment, safety concerns, or privacy breaches." onPress={() => Alert.alert('Report', 'Use Help & support to file a report — it goes straight to the safety queue.')} />
        <SafetyCard icon="hand-left-outline" title="Block a user" body="Blocking stops all messaging and booking requests between you and that person immediately." onPress={() => Alert.alert('Block', 'Open a conversation or profile and choose Block.')} />
        <SafetyCard icon="shield-checkmark-outline" title="Trusted contact" body="Optionally share your session time with a trusted contact. Manage this in Settings → Privacy." onPress={() => {}} />
        <SafetyCard icon="time-outline" title="Session check-in / check-out" body="Optional tap when your session starts and ends. If you press 'I need help', our support team is alerted. This does NOT automatically call emergency services." onPress={() => {}} />
        <SafetyCard icon="call-outline" title="Emergency guidance" body="If you are in immediate danger, contact the Botswana Police Service on 999 or 911. Pillow Thief is not an emergency service." onPress={() => Linking.openURL('tel:999')} />

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          What's not allowed
        </Text>
        <Card>
          {[
            'Sexual solicitation or sexual services',
            'Coercion, harassment, threats or stalking',
            'Fraud or identity misrepresentation',
            'Recording a session without consent',
            'Sharing another person’s private information',
          ].map((rule) => (
            <View key={rule} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm }}>
              <Ionicons name="close-circle" size={18} color={t.error} />
              <Text style={{ flex: 1, color: t.text, fontSize: typography.size.sm }}>{rule}</Text>
            </View>
          ))}
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs }}>
            Violations lead to review and proportionate account restrictions. Reporting harassment or stopping an unsafe session never counts against you.
          </Text>
        </Card>

        <Card style={{ marginTop: spacing.md }} onPress={callSupport}>
          <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold }}>Contact support →</Text>
        </Card>
      </ScrollView>
    </View>
  )
}

function SafetyCard({ icon, title, body, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string; onPress: () => void }) {
  const t = useTheme()
  return (
    <Card style={{ marginBottom: spacing.sm }} onPress={onPress}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Ionicons name={icon} size={22} color={t.primaryDark} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>{title}</Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 2, lineHeight: 20 }}>{body}</Text>
        </View>
      </View>
    </Card>
  )
}
