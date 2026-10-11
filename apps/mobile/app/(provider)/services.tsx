import React, { useState } from 'react'
import { Alert, ScrollView, Text, TextInput, View } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, Field } from '../../src/components/ui'
import { radius, spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'
import { errorMessage } from '../../src/lib/api'
import { fmtMoney } from '../../src/lib/format'
import { serviceSchema } from '@pillow-thief/shared'

export default function ProviderServices() {
  return <ServicesBody />
}

function ServicesBody() {
  const t = useTheme()
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)

  const services = useQuery({
    queryKey: ['my-services', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb.from('provider_services').select('*').eq('provider_id', userId!).order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
  })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price30, setPrice30] = useState('')
  const [price60, setPrice60] = useState('')
  const [price90, setPrice90] = useState('')
  const [price120, setPrice120] = useState('')

  const save = useMutation({
    mutationFn: async () => {
      const toMinor = (v: string) => (v.trim() === '' ? null : Math.round(parseFloat(v) * 100))
      const parsed = serviceSchema.safeParse({
        title,
        description,
        price60: toMinor(price60) ?? 0,
        price30: toMinor(price30),
        price90: toMinor(price90),
        price120: toMinor(price120),
      })
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid service')
      const sb = requireSupabase()
      const { error } = await sb.from('provider_services').insert({
        provider_id: userId,
        title: parsed.data.title,
        description: parsed.data.description,
        price_30_minor: parsed.data.price30 ?? null,
        price_60_minor: parsed.data.price60,
        price_90_minor: parsed.data.price90 ?? null,
        price_120_minor: parsed.data.price120 ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setTitle(''); setDescription(''); setPrice30(''); setPrice60(''); setPrice90(''); setPrice120('')
      qc.invalidateQueries({ queryKey: ['my-services'] })
    },
    onError: (err) => Alert.alert('Could not save service', errorMessage(err)),
  })

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const sb = requireSupabase()
      const { error } = await sb.from('provider_services').update({ active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-services'] }),
  })

  const PRICE_FIELDS: PriceField[] = [
    { label: '30', value: price30, onChange: setPrice30 },
    { label: '60', value: price60, onChange: setPrice60 },
    { label: '90', value: price90, onChange: setPrice90 },
    { label: '120', value: price120, onChange: setPrice120 },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Services & pricing' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginBottom: spacing.sm }}>Your services</Text>
        {(services.data ?? []).length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginBottom: spacing.lg }}>No services yet — add your first below.</Text>
        ) : (
          (services.data ?? []).map((s) => (
            <Card key={s.id} style={{ marginBottom: spacing.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, flex: 1 }}>{s.title}</Text>
                <Text
                  onPress={() => toggleActive.mutate({ id: s.id, active: !s.active })}
                  style={{ color: s.active ? t.success : t.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm }}
                >
                  {s.active ? 'Active' : 'Paused'}
                </Text>
              </View>
              <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, marginTop: spacing.xs }}>
                60 min: {fmtMoney(s.price_60_minor, s.currency)}
              </Text>
            </Card>
          ))
        )}

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginVertical: spacing.sm }}>Add a service</Text>
        <Field label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Classic Comfort Cuddle" />
        <Field label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={3} placeholder="What the session includes (20–600 characters)." />
        <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: spacing.sm }}>Prices in pula (P). Leave blank for durations you don't offer. 60 min is required.</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
          {PRICE_FIELDS.map((row) => (
            <View key={row.label} style={{ flex: 1 }}>
              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: 2 }}>{row.label} min</Text>
              <TextInput
                value={row.value}
                onChangeText={row.onChange}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={t.textMuted}
                style={{ backgroundColor: t.surface, borderRadius: radius.md, borderWidth: 1, borderColor: t.border, padding: spacing.sm, color: t.text, textAlign: 'center' }}
              />
            </View>
          ))}
        </View>
        <Button title="Save service" loading={save.isPending} onPress={() => save.mutate()} />
      </ScrollView>
    </View>
  )
}

interface PriceField {
  label: string
  value: string
  onChange: (v: string) => void
}
