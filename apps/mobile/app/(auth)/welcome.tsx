import React from 'react'
import { Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Button, SafetyAlert, Screen } from '../../src/components/ui'
import { colors, spacing, typography, useTheme } from '../../src/theme'

export default function Welcome() {
  const t = useTheme()
  const router = useRouter()
  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
          <View
            style={{
              alignSelf: 'center',
              width: 96,
              height: 96,
              borderRadius: 28,
              backgroundColor: t.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="moon" size={44} color={t.textOnPrimary} />
          </View>
          <Text
            style={{
              color: t.primaryDark,
              fontFamily: typography.fontFamily.handwritten,
              fontSize: typography.size.xxxl + 8,
              textAlign: 'center',
            }}
          >
            Pillow Thief
          </Text>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, textAlign: 'center' }}>
            Steal a cuddle.{'\n'}Keep the comfort.
          </Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.md, textAlign: 'center', lineHeight: 22 }}>
            Real people. Genuine connection. Just cuddles.{'\n'}Professional, verified cuddle providers in Gaborone.
          </Text>
          <SafetyAlert
            title="Non-sexual, consent-first"
            body="Every session is professional and non-sexual. Boundaries are agreed in advance, and either person may pause or end a session at any time."
          />
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            <Button title="Find a Cuddle" icon="heart" onPress={() => router.push('/(auth)/register')} />
            <Button title="Become a Cuddle Provider" variant="premium" onPress={() => router.push('/(auth)/register?as=provider')} />
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Link href="/(auth)/login">
                <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>
                  I already have an account
                </Text>
              </Link>
            </View>
          </View>
          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, textAlign: 'center' }}>
            18+ only · BWP · Gaborone, Botswana
          </Text>
        </View>
      </SafeAreaView>
    </Screen>
  )
}
