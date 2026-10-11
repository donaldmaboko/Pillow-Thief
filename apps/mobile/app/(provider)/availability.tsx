import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Card, SafetyAlert } from '../../src/components/ui'
import { spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'
import { errorMessage } from '../../src/lib/api'
import { minutesToHHmm } from '../../src/lib/format'
import { availabilityWindowSchema } from '@pillow-thief/shared'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const TIMES = Array.from({ length: 48 }, (_, i) => i * 30) // every 30 min

export default function ProviderAvailability() {
  const t = useTheme()
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)

  const q = useQuery({
    queryKey: ['my-availability', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const sb = requireSupabase()
      const { data, error } = await sb.from('provider_availability').select('*').eq('provider_id', userId!).order('weekday').order('start_minutes')
      if (error) throw error
      return data ?? []
    },
  })

  const [weekday, setWeekday] = useState(1)
  const [startMin, setStartMin] = useState(10 * 60)
  const [endMin, setEndMin] = useState(18 * 60)

  const add = useMutation({
    mutationFn: async () => {
      const parsed = availabilityWindowSchema.safeParse({ weekday, startMinutes: startMin, endMinutes: endMin })
      if (!parsed.success) throw new Error(parsed.error.errors[0]?.message ?? 'Invalid window')
      const sb = requireSupabase()
      const { error } = await sb.from('provider_availability').insert({
        provider_id: userId,
        weekday,
        start_minutes: startMin,
        end_minutes: endMin,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
    onError: (err) => Alert.alert('Could not add window', errorMessage(err)),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const sb = requireSupabase()
      const { error } = await sb.from('provider_availability').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-availability'] }),
  })

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Availability' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <SafetyAlert
          title="How availability works"
          body="These weekly windows repeat every week. Confirmed bookings automatically block the time. Add dated exceptions for days off."
        />

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginVertical: spacing.md }}>Your weekly windows</Text>
        {(q.data ?? []).length === 0 ? (
          <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>No availability set yet — clients can't book you until you add some.</Text>
        ) : (
          DAYS.map((day, idx) => {
            const windows = (q.data ?? []).filter((w) => w.weekday === idx)
            if (windows.length === 0) return null
            return (
              <Card key={day} style={{ marginBottom: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>{day}</Text>
                {windows.map((w) => (
                  <View key={w.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs }}>
                    <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>
                      {minutesToHHmm(w.start_minutes)} – {minutesToHHmm(w.end_minutes)}
                    </Text>
                    <Text onPress={() => remove.mutate(w.id)} style={{ color: t.error, fontSize: typography.size.sm }}>
                      Remove
                    </Text>
                  </View>
                ))}
              </Card>
            )
          })
        )}

        <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg, marginVertical: spacing.md }}>Add a window</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {DAYS.map((d, i) => (
              <View key={d}>
                <Text
                  onPress={() => setWeekday(i)}
                  style={{
                    backgroundColor: weekday === i ? t.primary : t.surface,
                    color: weekday === i ? t.textOnPrimary : t.text,
                    borderRadius: 999,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    overflow: 'hidden',
                    fontFamily: typography.fontFamily.semibold,
                    fontSize: typography.size.sm,
                  }}
                >
                  {d.slice(0, 3)}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: 4 }}>From</Text>
            <TimePicker value={startMin} onChange={setStartMin} theme={t} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginBottom: 4 }}>To</Text>
            <TimePicker value={endMin} onChange={setEndMin} theme={t} />
          </View>
        </View>

        <Button title="Add availability" loading={add.isPending} onPress={() => add.mutate()} />
      </ScrollView>
    </View>
  )
}

function TimePicker({ value, onChange, theme }: { value: number; onChange: (v: number) => void; theme: ReturnType<typeof useTheme> }) {
  return (
    <ScrollView style={{ maxHeight: 120, backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
      {TIMES.map((m) => (
        <Text
          key={m}
          onPress={() => onChange(m)}
          style={{
            padding: spacing.sm,
            textAlign: 'center',
            color: value === m ? theme.primaryDark : theme.text,
            backgroundColor: value === m ? `${theme.primary}22` : 'transparent',
            fontFamily: typography.fontFamily.semibold,
            fontSize: typography.size.sm,
          }}
        >
          {minutesToHHmm(m)}
        </Text>
      ))}
    </ScrollView>
  )
}
