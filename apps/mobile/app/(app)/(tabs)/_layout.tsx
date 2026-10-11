import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../../../src/theme'
import { useSession } from '../../../src/stores/session'

export default function TabsLayout() {
  const t = useTheme()
  const isProvider = useSession((s) => s.isProvider)
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.primaryDark,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: 'Discover', tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="map"
        options={{ title: 'Explore Map', tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: isProvider ? 'Requests' : 'Bookings', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={String(color)} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={String(color)} /> }}
      />
    </Tabs>
  )
}
