import React from 'react'
import { FlatList, Text, View } from 'react-native'
import { Stack } from 'expo-router'
import { EmptyState, ErrorState } from '../src/components/ui'
import { ProviderCard } from '../src/components/ProviderCard'
import { spacing, typography, useTheme } from '../src/theme'
import { useDiscovery, useFavourites } from '../src/lib/queries'

export default function FavouritesScreen() {
  const t = useTheme()
  const favs = useFavourites()
  const discovery = useDiscovery()

  const favProviders = (discovery.data ?? []).filter((p) => (favs.data ?? []).some((f) => f.provider_id === p.provider_id))

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen options={{ headerShown: true, title: 'Saved providers' }} />
      <FlatList
        data={favProviders}
        keyExtractor={(p) => p.provider_id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}
        ListEmptyComponent={<>
          favs.isLoading || discovery.isLoading ? null : (
            <EmptyState icon="heart-outline" title="No saved providers" body="Tap the heart on any provider profile to keep them here." />
          )
        </>
        }
        renderItem={({ item }) => <ProviderCard provider={item} />}
      />
    </View>
  )
}
