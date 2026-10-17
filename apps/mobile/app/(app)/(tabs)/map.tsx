import React, { useMemo, useRef, useState } from 'react'
import { Alert, Dimensions, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import Constants from 'expo-constants'
import * as Location from 'expo-location'
import MapView, { Marker, type Region } from 'react-native-maps'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Avatar, Chip, RatingStars, SafetyAlert, VerifiedBadge } from '../../../src/components/ui'
import { ProviderCard } from '../../../src/components/ProviderCard'
import { radius, shadows, spacing, typography, useTheme } from '../../../src/theme'
import { useDiscovery, type DiscoveryProvider } from '../../../src/lib/queries'
import { fmtMoney } from '../../../src/lib/format'

// Gaborone CBD — the launch city.
const GABORONE: Region = {
  latitude: -24.6282,
  longitude: 25.9231,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
}

const CITY_PRESETS: Record<string, Region> = {
  'Gaborone CBD': GABORONE,
  Phakalane: { latitude: -24.567, longitude: 25.983, latitudeDelta: 0.05, longitudeDelta: 0.05 },
  Mogoditshane: { latitude: -24.5969, longitude: 25.8606, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  Broadhurst: { latitude: -24.617, longitude: 25.906, latitudeDelta: 0.05, longitudeDelta: 0.05 },
}

export default function ExploreMapScreen() {
  const t = useTheme()
  const router = useRouter()
  const mapRef = useRef<MapView>(null)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<DiscoveryProvider | null>(null)
  const [region, setRegion] = useState<Region>(GABORONE)

  const discovery = useDiscovery({ search: search || undefined })
  const providers = useMemo(
    () => (discovery.data ?? []).filter((p) => p.lat != null && p.lng != null),
    [discovery.data],
  )

  const mapsKeyConfigured =
    Boolean(Constants.expoConfig?.ios?.config?.googleMapsApiKey) ||
    Boolean(Constants.expoConfig?.android?.config?.googleMaps?.apiKey)

  const locateMe = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location permission', 'Location access was declined. You can still search manually using the city selector or search bar.')
        return
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      const next: Region = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        latitudeDelta: 0.06,
        longitudeDelta: 0.06,
      }
      setRegion(next)
      mapRef.current?.animateToRegion(next, 500)
    } catch {
      Alert.alert('Location unavailable', 'Could not determine your location. Try the manual city selector instead.')
    }
  }

  const searchArea = () => {
    // Re-query providers around the current region bounds.
    discovery.refetch()
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <View style={{ flex: 1 }}>
        {/* Header controls */}
        <View style={{ padding: spacing.lg, gap: spacing.sm, backgroundColor: t.bg, zIndex: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xl }}>
              Explore Map
            </Text>
            <View style={{ flexDirection: 'row', backgroundColor: t.surface, borderRadius: radius.pill, borderWidth: 1, borderColor: t.border }}>
              {(['map', 'list'] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.xs + 2,
                    borderRadius: radius.pill,
                    backgroundColor: view === v ? t.primary : 'transparent',
                  }}
                >
                  <Text style={{ color: view === v ? t.textOnPrimary : t.textMuted, fontFamily: typography.fontFamily.semibold, fontSize: typography.size.sm }}>
                    {v === 'map' ? 'Map' : 'List'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.surface, borderRadius: radius.pill, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: t.border }}>
            <Ionicons name="search" size={18} color={t.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search providers or areas"
              placeholderTextColor={t.textMuted}
              style={{ flex: 1, paddingVertical: spacing.md - 2, marginLeft: spacing.sm, color: t.text, fontSize: typography.size.sm }}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row' }}>
              {Object.keys(CITY_PRESETS).map((name) => (
                <Chip
                  key={name}
                  label={name}
                  onPress={() => {
                    const r = CITY_PRESETS[name]
                    if (!r) return
                    setRegion(r)
                    mapRef.current?.animateToRegion(r, 500)
                  }}
                />
              ))}
            </View>
          </ScrollView>
        </View>

        {discovery.isLoading && providers.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: t.textMuted }}>Loading providers…</Text>
          </View>
        ) : view === 'list' ? (
          <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 160 }}>
            {(discovery.data ?? []).length === 0 ? (
              <Text style={{ color: t.textMuted, textAlign: 'center', marginTop: spacing.xxxl }}>
                No providers found in this area yet.
              </Text>
            ) : (
              (discovery.data ?? []).map((p) => <ProviderCard key={p.provider_id} provider={p} />)
            )}
          </ScrollView>
        ) : (
          <View style={{ flex: 1 }}>
            {!mapsKeyConfigured ? (
              <View style={{ padding: spacing.lg }}>
                <SafetyAlert
                  tone="warning"
                  title="Google Maps key not configured"
                  body="Live tiles need a development build with your Google Maps API keys (see docs/GOOGLE_MAPS.md). Provider locations below are approximate and come from the backend."
                />
              </View>
            ) : null}
            <MapView
              ref={mapRef}
              style={{ flex: 1 }}
              initialRegion={region}
              onRegionChangeComplete={setRegion}
              showsUserLocation={false}
            >
              {providers.map((p) => (
                <Marker
                  key={p.provider_id}
                  coordinate={{ latitude: p.lat!, longitude: p.lng! }}
                  title={p.display_name}
                  onPress={() => setSelected(p)}
                >
                  <View
                    style={{
                      backgroundColor: selected?.provider_id === p.provider_id ? t.primaryDark : t.primary,
                      borderRadius: radius.pill,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.xs + 2,
                      borderWidth: 2,
                      borderColor: t.white,
                      ...shadows.card,
                    }}
                  >
                    <Text style={{ color: t.white, fontFamily: typography.fontFamily.bold, fontSize: typography.size.xs }}>
                      {p.display_name}
                    </Text>
                  </View>
                </Marker>
              ))}
            </MapView>

            {/* Floating controls */}
            <View style={{ position: 'absolute', right: spacing.lg, bottom: selected ? 240 : spacing.xl, gap: spacing.sm }}>
              <RoundButton icon="locate" onPress={locateMe} label="Current location" />
              <RoundButton icon="refresh" onPress={searchArea} label="Search this area" />
            </View>

            {/* Provider preview bottom sheet */}
            {selected ? (
              <View
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: t.surface,
                  borderTopLeftRadius: radius.xl,
                  borderTopRightRadius: radius.xl,
                  padding: spacing.lg,
                  ...shadows.sheet,
                }}
              >
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <Avatar uri={selected.avatar_url} name={selected.display_name} size={56} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                      <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
                        {selected.display_name}
                      </Text>
                      <VerifiedBadge small />
                    </View>
                    <Text style={{ color: t.textMuted, fontSize: typography.size.sm }} numberOfLines={1}>
                      {selected.headline}
                    </Text>
                    <RatingStars rating={selected.avg_rating} count={selected.review_count} />
                  </View>
                  <Pressable onPress={() => setSelected(null)} hitSlop={8}>
                    <Ionicons name="close" size={22} color={t.textMuted} />
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md }}>
                  <Text style={{ color: t.primaryDark, fontFamily: typography.fontFamily.bold, fontSize: typography.size.md }}>
                    {selected.starting_price_minor != null ? `from ${fmtMoney(selected.starting_price_minor)}` : 'Contact for pricing'}
                  </Text>
                  <Pressable
                    onPress={() => router.push({ pathname: '/provider/[id]', params: { id: selected.provider_id } })}
                    style={{ backgroundColor: t.primary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}
                  >
                    <Text style={{ color: t.textOnPrimary, fontFamily: typography.fontFamily.bold, fontSize: typography.size.sm }}>
                      View profile
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

function RoundButton({ icon, onPress, label }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  const t = useTheme()
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: t.surface,
        alignItems: 'center',
        justifyContent: 'center',
        ...shadows.card,
      }}
    >
      <Ionicons name={icon} size={20} color={t.primaryDark} />
    </Pressable>
  )
}
