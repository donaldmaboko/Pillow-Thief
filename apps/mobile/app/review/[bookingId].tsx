import React, { useState } from 'react'
import { Alert, ScrollView, Text, TextInput, View, Pressable } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Field } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { useSubmitReview } from '../../src/lib/queries'
import { errorMessage } from '../../src/lib/api'

const DIMENSIONS: { key: string; label: string }[] = [
  { key: 'professionalism', label: 'Professionalism' },
  { key: 'punctuality', label: 'Punctuality' },
  { key: 'communication', label: 'Communication' },
  { key: 'respect_for_boundaries', label: 'Respect for boundaries' },
  { key: 'accuracy', label: 'Service matched description' },
]

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()
  const t = useTheme()
  const router = useRouter()
  const submit = useSubmitReview()
  const [rating, setRating] = useState(0)
  const [scores, setScores] = useState<Record<string, number>>({})
  const [body, setBody] = useState('')

  const allScored = rating > 0 && DIMENSIONS.every((d) => scores[d.key])

  const onSave = () => {
    if (!allScored) return Alert.alert('Almost there', 'Please rate the overall experience and every dimension.')
    submit.mutate(
      { booking_id: bookingId, rating, body: body || null, ...scores },
      {
        onSuccess: () => {
          Alert.alert('Thank you', 'Your genuine review helps other clients.', [{ text: 'Done', onPress: () => router.back() }])
        },
        onError: (err) => Alert.alert('Could not submit review', errorMessage(err)),
      },
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Leave a review' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontSize: typography.size.md, marginBottom: spacing.lg, lineHeight: 22 }}>
          Reviews are only open for completed bookings and can't be edited later. Please describe your genuine experience.
        </Text>

        <Card style={{ marginBottom: spacing.md, alignItems: 'center' }}>
          <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, marginBottom: spacing.sm }}>Overall experience</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Pressable key={i} onPress={() => setRating(i)}>
                <Ionicons name={i <= rating ? 'star' : 'star-outline'} size={34} color="#E9A23B" />
              </Pressable>
            ))}
          </View>
        </Card>

        {DIMENSIONS.map((d) => (
          <Card key={d.key} style={{ marginBottom: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: t.text, fontFamily: typography.fontFamily.semibold }}>{d.label}</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Pressable key={i} onPress={() => setScores((s) => ({ ...s, [d.key]: i }))}>
                    <Ionicons name={i <= (scores[d.key] ?? 0) ? 'star' : 'star-outline'} size={20} color="#E9A23B" />
                  </Pressable>
                ))}
              </View>
            </View>
          </Card>
        ))}

        <Field
          label="Written feedback (optional)"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          placeholder="What stood out? Would you book again?"
        />

        <Button title="Submit review" loading={submit.isPending} disabled={!allScored} onPress={onSave} />
      </ScrollView>
    </View>
  )
}
