import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Link, useRouter, useLocalSearchParams } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registrationSchema, type RegistrationInput } from '@pillow-thief/shared'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Field, Screen } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'

export default function Register() {
  const t = useTheme()
  const router = useRouter()
  const params = useLocalSearchParams<{ as?: string }>()
  const asProvider = params.as === 'provider'
  const [loading, setLoading] = useState(false)
  const { control, handleSubmit } = useForm<RegistrationInput>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
      isOver18: false as unknown as true,
      acceptTerms: false as unknown as true,
      acceptPrivacy: false as unknown as true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true)
    try {
      const sb = requireSupabase()
      const { data, error } = await sb.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          data: { display_name: values.displayName, intended_role: asProvider ? 'provider' : 'client' },
          emailRedirectTo: 'pillowthief://auth-callback',
        },
      })
      if (error) throw error
      if (data.session) {
        router.replace('/')
      } else {
        Alert.alert(
          'Confirm your email',
          'We sent a verification link to your inbox. Open it, then sign in here.',
          [{ text: 'Go to sign in', onPress: () => router.replace('/(auth)/login') }],
        )
      }
    } catch (err) {
      Alert.alert('Registration failed', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setLoading(false)
    }
  })

  return (
    <Screen>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingVertical: spacing.xl }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxxl, marginBottom: spacing.xs }}>
            {asProvider ? 'Become a provider' : 'Create account'}
          </Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.md, marginBottom: spacing.xl }}>
            {asProvider
              ? 'Apply to offer professional, consent-first cuddling. Verification is required before publishing.'
              : 'Join to book verified cuddle providers near you.'}
          </Text>
          <Controller control={control} name="displayName" render={({ field, fieldState }) => (
            <Field label="Display name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} placeholder="What should providers call you?" />
          )} />
          <Controller control={control} name="email" render={({ field, fieldState }) => (
            <Field label="Email" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
          )} />
          <Controller control={control} name="password" render={({ field, fieldState }) => (
            <Field label="Password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} secure hint="At least 8 characters." />
          )} />
          <Controller control={control} name="confirmPassword" render={({ field, fieldState }) => (
            <Field label="Confirm password" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} secure />
          )} />
          <Controller control={control} name="isOver18" render={({ field, fieldState }) => (
            <ConsentRow label="I confirm I am 18 years or older." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="acceptTerms" render={({ field, fieldState }) => (
            <ConsentRow label="I accept the Terms of Service." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="acceptPrivacy" render={({ field, fieldState }) => (
            <ConsentRow label="I accept the Privacy Policy." value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
          )} />
          <Button title={asProvider ? 'Apply to become a provider' : 'Create account'} loading={loading} onPress={onSubmit} />
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg }}>
            <Link href="/(auth)/login">
              <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.semibold }}>Already have an account? Sign in</Text>
            </Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Screen>
  )
}

function ConsentRow({ label, value, onChange, error }: { label: string; value: boolean; onChange: (v: true) => void; error?: string }) {
  const t = useTheme()
  return (
    <View style={{ marginBottom: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            width: 22, height: 22, borderRadius: 6,
            borderWidth: 2, borderColor: value ? t.primary : t.border,
            backgroundColor: value ? t.primary : 'transparent',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {value ? <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text> : null}
        </View>
        <Text style={{ flex: 1, color: t.text, fontSize: typography.size.sm }} onPress={() => value || onChange(true)}>
          {label}
        </Text>
      </View>
      {error ? <Text style={{ color: t.error, fontSize: typography.size.xs, marginTop: 4 }}>{error}</Text> : null}
    </View>
  )
}
