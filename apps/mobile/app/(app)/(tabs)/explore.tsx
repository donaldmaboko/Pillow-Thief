import React, { useState } from 'react'
import { ScrollView, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Chip, EmptyState, ErrorState, CardSkeleton } from '../../../src/components/ui'
import { ProviderCard } from '../../../src/components/ProviderCard'
import { radius, spacing, typography, useTheme } from '../../../src/theme'
import { useDiscovery, type DiscoveryFilters } from '../../../src/lib/queries'

const CITIES = ['Gaborone', 'Phakalane', 'Mogoditshane', 'Mochudi']
const ARRANGEMENTS = [
  { key: 'provider_travels', label: 'House calls' },
  { key: 'client_visits', label: 'Visit provider' },
  { key: 'public_meeting', label: 'Public meeting' },
]
const SORTS: { key: NonNullable<DiscoveryFilters['sortBy']>; label: string }[] = [
  { key: 'relevance', label: 'Recommended' },
  { key: 'price', label: 'Price' },
  { key: 'rating', label: 'Rating' },
]

export default function Explore() {
  const t = useTheme()
  const [search, setSearch] = useState('')
  const [city, setCity] = useState<string | undefined>(undefined)
  const [arrangement, setArrangement] = useState<string | undefined>(undefined)
  const [sortBy, setSortBy] = useState<NonNullable<DiscoveryFilters['sortBy']>>('relevance')

  const filters: DiscoveryFilters = { search: search || undefined, city, arrangement, sortBy }
  const discovery = useDiscovery(filters)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ padding: spacing.lg, flex: 1 }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl, marginBottom: spacing.md }}>
          Discover providers
        </Text>

        {/* Search */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: t.surface,
            borderRadius: radius.pill,
            paddingHorizontal: spacing.lg,
            borderWidth: 1,
            borderColor: t.border,
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name="search" size={18} color={t.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or area…"
            placeholderTextColor={t.textMuted}
            style={{ flex: 1, paddingVertical: spacing.md, marginLeft: spacing.sm, color: t.text, fontSize: typography.size.md }}
          />
        </View>

        {/* Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row' }}>
            {CITIES.map((c) => (
              <Chip key={c} label={c} selected={city === c} onPress={() => setCity(city === c ? undefined : c)} />
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row' }}>
            {ARRANGEMENTS.map((a) => (
              <Chip key={a.key} label={a.label} selected={arrangement === a.key} onPress={() => setArrangement(arrangement === a.key ? undefined : a.key)} />
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row' }}>
            {SORTS.map((s) => (
              <Chip key={s.key} label={s.label} selected={sortBy === s.key} onPress={() => setSortBy(s.key)} />
            ))}
          </View>
        </ScrollView>

        {/* Results */}
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxxl }} showsVerticalScrollIndicator={false}>
          {discovery.isLoading ? (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          ) : discovery.isError ? (
            <ErrorState message="Couldn't load providers. Check your connection." onRetry={() => discovery.refetch()} />
          ) : (discovery.data ?? []).length === 0 ? (
            <EmptyState
              icon="search-outline"
              title="No providers match"
              body="Try clearing some filters, or search a different area of Gaborone."
            />
          ) : (
            (discovery.data ?? []).map((p) => <ProviderCard key={p.provider_id} provider={p} />)
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  )
}
