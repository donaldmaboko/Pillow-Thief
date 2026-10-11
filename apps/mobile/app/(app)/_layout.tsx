import React from 'react'
import { Redirect, Stack } from 'expo-router'
import { useSession } from '../../src/stores/session'
import { useTheme } from '../../src/theme'

export default function AppLayout() {
  const userId = useSession((s) => s.userId)
  const t = useTheme()
  if (!userId) return <Redirect href="/(auth)/welcome" />
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
}
