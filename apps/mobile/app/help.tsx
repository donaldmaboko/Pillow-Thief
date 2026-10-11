import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { Button, Card, Field } from '../src/components/ui'
import { radius, spacing, typography, useTheme } from '../src/theme'
import { requireSupabase } from '../src/lib/supabase'
import { errorMessage } from '../src/lib/api'
import { supportTicketSchema, SUPPORT_TICKET_CATEGORIES } from '@pillow-thief/shared'

export default function HelpScreen() {
  const t = useTheme()
  const router = useRouter()
  const [category, setCategory] = useState<(typeof SUPPORT_TICKET_CATEGORIES)[number]>('booking')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    const parsed = supportTicketSchema.safeParse({ category, subject, body })
    if (!parsed.success) return Alert.alert('Check the form', parsed.error.errors[0]?.message ?? 'Please complete all fields.')
    setSubmitting(true)
    try {
      const sb = requireSupabase()
      const uid = (await sb.auth.getUser()).data.user?.id
      const { error } = await sb.from('support_tickets').insert({ user_id: uid, ...parsed.data })
      if (error) throw error
      Alert.alert('Ticket created', 'Our team will reply in-app. You can track it under Help.', [{ text: 'Done', onPress: () => router.back() }])
    } catch (err) {
      Alert.alert('Could not submit', errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Help & support' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontSize: typography.size.md, marginBottom: spacing.lg, lineHeight: 22 }}>
          Tell us what's going on. Safety reports are prioritised and handled confidentially.
        </Text>

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold, marginBottom: spacing.sm }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg }}>
          {SUPPORT_TICKET_CATEGORIES.map((c) => (
            <View
              key={c}
              style={{ backgroundColor: category === c ? t.primary : t.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: category === c ? t.primary : t.border }}
            >
              <Text onPress={() => setCategory(c)} style={{ color: category === c ? t.textOnPrimary : t.text, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm, textTransform: 'capitalize' }}>
                {c}
              </Text>
            </View>
          ))}
        </View>

        <Field label="Subject" value={subject} onChangeText={setSubject} placeholder="Short summary" />
        <Field label="What happened?" value={body} onChangeText={setBody} multiline numberOfLines={6} placeholder="Give us as much detail as you're comfortable with (at least 10 characters)." />

        <Button title="Submit" loading={submitting} onPress={submit} />

        <Card style={{ marginTop: spacing.xl }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, marginBottom: spacing.sm }}>Need urgent help?</Text>
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm, lineHeight: 20 }}>
            If you're in immediate danger, contact the Botswana Police Service on 999/911. For session safety, open the Safety centre.
          </Text>
        </Card>
      </ScrollView>
    </View>
  )
}
