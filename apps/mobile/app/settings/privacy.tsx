import React from 'react'
import { ScrollView, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { Card, SafetyAlert } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'

export default function PrivacySettings() {
  const t = useTheme()
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Privacy settings' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <SafetyAlert
          title="How your location is used"
          body="Location is only used when you search for providers or set a meeting point. We never share your exact address with other users, and we don't track you in the background."
        />

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginTop: spacing.xl, marginBottom: spacing.sm }}>
          What's protected
        </Text>
        <Card style={{ marginBottom: spacing.md }}>
          {[
            ['Your home address', 'Only shared with a confirmed provider for house-call sessions.'],
            ['Provider home locations', 'Providers show service areas, never their exact address.'],
            ['Identity documents', 'Used only for verification, stored privately, never shown publicly.'],
            ['Payment details', 'Handled by our payment provider — we never store card numbers.'],
          ].map(([title, body]) => (
            <View key={title} style={{ marginBottom: spacing.md }}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.md }}>{title}</Text>
              <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 2 }}>{body}</Text>
            </View>
          ))}
        </Card>

        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, lineHeight: 20 }}>
          Read the full Privacy Policy for retention periods and your rights, including access and deletion requests.
        </Text>
      </ScrollView>
    </View>
  )
}
