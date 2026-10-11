import React, { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Link, useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@pillow-thief/shared'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Field, Screen } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'

export default function Login() {
  const t = useTheme()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true)
    try {
      const sb = requireSupabase()
      const { error } = await sb.auth.signInWithPassword({ email: values.email, password: values.password })
      if (error) throw error
      router.replace('/')
    } catch (err) {
      Alert.alert('Sign in failed', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setLoading(false)
    }
  })

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxxl, marginBottom: spacing.xs }}>
            Welcome back
          </Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.md, marginBottom: spacing.xl }}>
            Sign in to find your comfort.
          </Text>
          <Controller
            control={control}
            name="email"
            render={({ field, fieldState }) => (
              <Field label="Email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field, fieldState }) => (
              <Field label="Password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} secure placeholder="••••••••" />
            )}
          />
          <Button title="Sign in" loading={loading} onPress={onSubmit} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg }}>
            <Link href="/(auth)/forgot">
              <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Forgot password?</Text>
            </Link>
            <Link href="/(auth)/register">
              <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Create account</Text>
            </Link>
          </View>
        </View>
      </SafeAreaView>
    </Screen>
  )
}
