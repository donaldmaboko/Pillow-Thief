import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Button, Card, SafetyAlert } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { api, errorMessage } from '../../src/lib/api'
import { useSession } from '../../src/stores/session'

export default function DeleteAccount() {
  const t = useTheme()
  const router = useRouter()
  const [working, setWorking] = useState(false)

  const doDelete = () => {
    Alert.alert(
      'Delete your account?',
      'This deactivates your profile immediately, cancels future bookings, and queues permanent deletion. Financial and safety records are retained as required by law.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setWorking(true)
            try {
              await api.deleteAccount()
              useSession.getState().signOut()
              router.replace('/(auth)/welcome')
            } catch (err) {
              Alert.alert('Deletion failed', errorMessage(err))
              setWorking(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Delete account' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <SafetyAlert tone="danger" title="This can't be undone" body="Deleting your account removes you from discovery, cancels upcoming sessions, and permanently deletes your profile." />
        <Card style={{ marginVertical: spacing.lg }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>What happens</Text>
          {[
            'Your profile is unpublished and hidden.',
            'Future bookings are cancelled.',
            'Your display name is anonymised.',
            'Financial records are retained per the retention schedule.',
          ].map((x) => (
            <Text key={x} style={{ color: t.textMuted, fontSize: typography.size.sm, marginBottom: 4 }}>• {x}</Text>
          ))}
        </Card>
        <Button title="Delete my account" variant="danger" loading={working} onPress={doDelete} />
        <Button title="Cancel" variant="ghost" onPress={() => router.back()} style={{ marginTop: spacing.md }} />
      </ScrollView>
    </View>
  )
}
