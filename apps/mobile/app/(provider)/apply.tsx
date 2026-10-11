import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { providerApplicationSchema, type ProviderApplicationInput, MEETING_ARRANGEMENT_LABELS } from '@pillow-thief/shared'
import { Button, Chip, Field, SafetyAlert } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { errorMessage } from '../../src/lib/api'

const LANGUAGES: { key: 'en' | 'tn' | 'af' | 'zu' | 'fr' | 'pt' | 'other'; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'tn', label: 'Setswana' },
  { key: 'af', label: 'Afrikaans' },
  { key: 'zu', label: 'isiZulu' },
  { key: 'fr', label: 'French' },
  { key: 'pt', label: 'Portuguese' },
  { key: 'other', label: 'Other' },
]

export default function ProviderApply() {
  const t = useTheme()
  const router = useRouter()
  const [languages, setLanguages] = useState<string[]>(['en'])
  const [arrangements, setArrangements] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const { control, handleSubmit } = useForm<ProviderApplicationInput>({
    resolver: zodResolver(providerApplicationSchema),
    defaultValues: {
      legalName: '',
      displayName: '',
      dateOfBirth: '',
      bio: '',
      languages: ['en'],
      city: 'Gaborone',
      neighbourhood: '',
      meetingArrangements: [],
      basePrice60: 25000,
      boundaries: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    if (languages.length === 0) return Alert.alert('Select at least one language')
    if (arrangements.length === 0) return Alert.alert('Select at least one meeting option')
    setSubmitting(true)
    try {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      const { error } = await sb.from('provider_applications').upsert({
        user_id: uid,
        status: 'pending',
        legal_name: values.legalName,
        date_of_birth: values.dateOfBirth,
        display_name: values.displayName,
        bio: values.bio,
        languages,
        city: values.city,
        neighbourhood: values.neighbourhood || null,
        accepts: arrangements,
        base_price_60_minor: values.basePrice60,
        boundaries: values.boundaries,
      })
      if (error) throw error
      Alert.alert('Application submitted', 'Our team verifies every applicant. You will be notified once a decision is made. New providers stay unpublished until approved.', [
        { text: 'OK', onPress: () => router.push('/(provider)/dashboard') },
      ])
    } catch (err) {
      Alert.alert('Application failed', errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Become a provider' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <SafetyAlert
          title="Professional & verified"
          body="Legal name and date of birth are private — used only for verification. Your public profile shows only your display name and bio."
        />

        <View style={{ marginTop: spacing.lg }}>
          <Controller control={control} name="legalName" render={({ field, fieldState }) => (
            <Field label="Legal name (private)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} hint="Never shown publicly." />
          )} />
          <Controller control={control} name="displayName" render={({ field, fieldState }) => (
            <Field label="Public display name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="dateOfBirth" render={({ field, fieldState }) => (
            <Field label="Date of birth (YYYY-MM-DD)" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} hint="You must be 18 or older." />
          )} />
          <Controller control={control} name="bio" render={({ field, fieldState }) => (
            <Field label="Bio" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} multiline numberOfLines={4} placeholder="Describe your style, experience and what clients can expect." />
          )} />

          <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>Languages spoken</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
            {LANGUAGES.map((l) => (
              <Chip key={l.key} label={l.label} selected={languages.includes(l.key)} onPress={() => setLanguages((cur) => cur.includes(l.key) ? cur.filter((x) => x !== l.key) : [...cur, l.key])} />
            ))}
          </View>

          <Controller control={control} name="city" render={({ field, fieldState }) => (
            <Field label="City" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
          )} />
          <Controller control={control} name="neighbourhood" render={({ field }) => (
            <Field label="Neighbourhood (optional)" value={field.value ?? ''} onChangeText={field.onChange} placeholder="e.g. Broadhurst" />
          )} />

          <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>Meeting options you'll offer</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.lg }}>
            {(Object.keys(MEETING_ARRANGEMENT_LABELS) as (keyof typeof MEETING_ARRANGEMENT_LABELS)[]).map((k) => (
              <Chip key={k} label={MEETING_ARRANGEMENT_LABELS[k]} selected={arrangements.includes(k)} onPress={() => setArrangements((cur) => cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k])} />
            ))}
          </View>

          <Controller control={control} name="basePrice60" render={({ field, fieldState }) => (
            <Field label="Base price for 60 minutes (thebe)" value={String(field.value)} onChangeText={(v) => field.onChange(Number(v.replace(/[^0-9]/g, '')) || 0)} error={fieldState.error?.message} keyboardType="numeric" hint={`Clients see ${'P' + Math.round(field.value / 100)}. Platform commission applies to completed bookings.`} />
          )} />

          <Controller control={control} name="boundaries" render={({ field, fieldState }) => (
            <Field label="Your boundaries" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} multiline numberOfLines={4} placeholder="e.g. Clothing stays on. No kissing. Either of us may stop at any time." />
          )} />

          <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: spacing.lg, lineHeight: 18 }}>
            All Pillow Thief services are non-sexual. Applications that advertise prohibited services are rejected.
          </Text>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: t.surface, borderTopWidth: 1, borderTopColor: t.border }}>
        <Button title="Submit application" loading={submitting} onPress={onSubmit} />
      </View>
    </View>
  )
}
