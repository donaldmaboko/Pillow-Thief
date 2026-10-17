import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { can } from '@pillow-thief/shared'
import { useTheme } from '../../../src/theme'
import { useSession } from '../../../src/stores/session'

/**
 * Tabs are composed from the role capability map, so the bar only ever offers
 * surfaces the current role may actually use.
 */
export default function TabsLayout() {
  const t = useTheme()
  const role = useSession((s) => s.role)
  const isProvider = useSession((s) => s.isProvider)

  const show = {
    deck: can(role, 'discover.swipe'),
    explore: can(role, 'discover.search'),
    map: can(role, 'discover.map'),
    bookings: can(role, 'book.create') || can(role, 'book.receive'),
    profile: true,
  }

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
        name="deck"
        options={{
          title: 'Cuddle',
          href: show.deck ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Discover',
          href: show.explore ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Explore Map',
          href: show.map ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="map" size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: isProvider ? 'Requests' : 'Bookings',
          href: show.bookings ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={String(color)} />,
        }}
      />
    </Tabs>
  )
}
