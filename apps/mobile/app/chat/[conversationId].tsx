import React, { useEffect, useState } from 'react'
import { FlatList, Text, TextInput, View } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { radius, spacing, typography, useTheme } from '../../src/theme'
import { requireSupabase } from '../../src/lib/supabase'
import { useSession } from '../../src/stores/session'
import { errorMessage } from '../../src/lib/api'
import { Alert, Pressable } from 'react-native'

interface Msg {
  id: string
  sender_id: string
  body: string
  kind: string
  created_at: string
  read_at: string | null
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>()
  const t = useTheme()
  const userId = useSession((s) => s.userId)
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const sb = requireSupabase()
    const load = async () => {
      const { data } = await sb.from('messages').select('id, sender_id, body, kind, created_at, read_at').eq('conversation_id', conversationId!).order('created_at', { ascending: true }).limit(200)
      setMessages((data ?? []) as Msg[])
      // Mark received as read.
      await sb.from('messages').update({ read_at: new Date().toISOString() }).eq('conversation_id', conversationId!).neq('sender_id', userId).is('read_at', null)
    }
    load()
    const channel = sb
      .channel(`messages-${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
        setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new as Msg]))
        if ((payload.new as Msg).sender_id !== userId) {
          sb.from('messages').update({ read_at: new Date().toISOString() }).eq('id', payload.new.id)
        }
      })
      .subscribe()
    return () => {
      sb.removeChannel(channel)
    }
  }, [conversationId, userId])

  const send = async () => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const sb = requireSupabase()
      const { error } = await sb.from('messages').insert({ conversation_id: conversationId, sender_id: userId, body, kind: 'text' })
      if (error) {
        if (error.message.includes('blocked')) setBlocked(true)
        throw error
      }
      setDraft('')
    } catch (err) {
      Alert.alert('Message not sent', errorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Messages' }} />
      {blocked ? (
        <View style={{ padding: spacing.lg }}>
          <Text style={{ color: t.error }}>Messaging is unavailable between you and this user.</Text>
        </View>
      ) : null}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        renderItem={({ item }) => {
          const mine = item.sender_id === userId
          const system = item.kind === 'system'
          return (
            <View
              style={{
                alignSelf: system ? 'center' : mine ? 'flex-end' : 'flex-start',
                backgroundColor: system ? t.surfaceMuted : mine ? t.primary : t.surface,
                borderRadius: radius.lg,
                borderBottomRightRadius: mine ? 4 : radius.lg,
                borderBottomLeftRadius: mine ? radius.lg : 4,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm + 2,
                maxWidth: '80%',
              }}
            >
              <Text style={{ color: system ? t.textMuted : mine ? t.textOnPrimary : t.text, fontSize: typography.size.md, lineHeight: 21 }}>
                {item.body}
              </Text>
              <Text style={{ color: mine ? 'rgba(255,255,255,0.7)' : t.textMuted, fontSize: typography.size.xs, marginTop: 2, textAlign: 'right' }}>
                {new Date(item.created_at).toLocaleTimeString('en-BW', { hour: '2-digit', minute: '2-digit' })}
                {!mine && item.read_at ? ' · read' : ''}
              </Text>
            </View>
          )
        }}
        inverted={false}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: t.border, backgroundColor: t.surface }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={t.textMuted}
          multiline
          style={{ flex: 1, backgroundColor: t.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: t.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, color: t.text, maxHeight: 100 }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: draft.trim() ? t.primary : t.border, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="send" size={18} color={t.textOnPrimary} />
        </Pressable>
      </View>
    </View>
  )
}
