import React from 'react'
import { Stack } from 'expo-router'
import { useTheme } from '../../src/theme'
import { RoleGate } from '../../src/features/roles/RoleGate'

/**
 * Provider studio guard. Closes the deep-link hole: before this existed a client
 * could navigate straight to /(provider)/dashboard.
 */
export default function ProviderLayout() {
  const t = useTheme()
  return (
    <RoleGate capability="provider.studio">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }} />
    </RoleGate>
  )
}
