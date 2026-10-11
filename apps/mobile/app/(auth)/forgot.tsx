import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Field, Screen } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'

export default function Forgot() {
  const t = useTheme()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    if (!email.includes('@')) return Alert.alert('Enter a valid email address')
    setLoading(true)
    try {
      const sb = requireSupabase()
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: 'pillowthief://auth-callback' })
      if (error) throw error
      setSent(true)
    } catch (err) {
      Alert.alert('Could not send reset link', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.sm }}>
            Reset your password
          </Text>
          {sent ? (
            <View style={{ gap: spacing.lg }}>
              <Text style={{ color: t.textMuted, fontSize: typography.size.md, lineHeight: 22 }}>
                If an account exists for {email}, we've sent a password reset link. Check your inbox.
              </Text>
              <Link href="/(auth)/login">
                <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Back to sign in</Text>
              </Link>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              <Text style={{ color: t.textMuted, fontSize: typography.size.md }}>
                Enter the email you registered with and we'll send you a reset link.
              </Text>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
              <Button title="Send reset link" loading={loading} onPress={submit} />
              <Link href="/(auth)/login" style={{ alignSelf: 'center' }}>
                <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Back to sign in</Text>
              </Link>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Screen>
  )
}
