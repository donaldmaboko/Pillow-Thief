import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../src/theme'
import { RoleGate } from '../../src/features/roles/RoleGate'

/**
 * Admin console. Guarded by the `admin.console` capability, which only the
 * admin role holds — and every action inside is independently refused by the
 * database if the JWT does not belong to an admin profile.
 */
export default function AdminLayout() {
  const t = useTheme()
  return (
    <RoleGate capability="admin.console">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.primaryDark,
          tabBarInactiveTintColor: t.textMuted,
          tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Console',
            tabBarIcon: ({ color, size }) => <Ionicons name="speedometer" size={size} color={String(color)} />,
          }}
        />
        <Tabs.Screen
          name="verification"
          options={{
            title: 'Verify',
            tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={String(color)} />,
          }}
        />
        <Tabs.Screen
          name="moderation"
          options={{
            title: 'Moderation',
            tabBarIcon: ({ color, size }) => <Ionicons name="flag" size={size} color={String(color)} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={String(color)} />,
          }}
        />
      </Tabs>
    </RoleGate>
  )
}
