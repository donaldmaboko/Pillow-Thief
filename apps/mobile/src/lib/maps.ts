import { Platform } from 'react-native'
import Constants from 'expo-constants'

/**
 * Can the native `<MapView>` actually paint tiles right now?
 *
 * This exists because "is a key configured?" is NOT the same question as "will
 * the map render". Expo Go dropped Google Maps support in SDK 52: the native
 * module is still there, so `<MapView>` mounts happily, but every tile request
 * is rejected and the user sees a blank grey rectangle with a Google logo. A
 * key cannot fix that — only a development build can.
 *
 * Getting this wrong is user-visible either way:
 *   * mounting the map in Expo Go on Android  -> grey box, looks broken
 *   * not mounting it on iOS in Expo Go       -> hides a map that works fine
 *     (iOS falls back to Apple Maps/MapKit, which needs no key at all)
 */

type ExecutionEnvironment = { executionEnvironment?: string; appOwnership?: string | null }

const constants = Constants as unknown as ExecutionEnvironment

/**
 * Expo Go (`storeClient`) vs a development/production build (`bare`/`standalone`).
 * `appOwnership` is the legacy field but is still populated, so either signal
 * is enough.
 */
export const IS_EXPO_GO =
  constants.executionEnvironment === 'storeClient' || constants.appOwnership === 'expo'

const hasAndroidKey =
  (Constants.expoConfig?.extra?.googleMapsAndroidKeyPresent as boolean | undefined) ??
  String(Constants.expoConfig?.android?.config?.googleMaps?.apiKey ?? '').trim().length > 0

const hasIosKey =
  (Constants.expoConfig?.extra?.googleMapsIosKeyPresent as boolean | undefined) ??
  String(Constants.expoConfig?.ios?.config?.googleMapsApiKey ?? '').trim().length > 0

/** Why the native map is not being mounted. `null` means it will render. */
export type MapsBlockedReason = 'expo-go' | 'no-key' | null

export interface MapsAvailability {
  /** True when `<MapView>` can be expected to paint real tiles. */
  nativeTiles: boolean
  /** Which SDK the native view will use, so the UI can label it honestly. */
  provider: 'google' | 'apple'
  /** Set when `nativeTiles` is false, and why. */
  reason: MapsBlockedReason
}

export function getMapsAvailability(): MapsAvailability {
  if (Platform.OS === 'ios') {
    // Default provider is Apple Maps (MapKit): no key, works in Expo Go.
    return {
      nativeTiles: true,
      provider: hasIosKey ? 'google' : 'apple',
      reason: null,
    }
  }

  if (IS_EXPO_GO) {
    // Not a configuration problem — Expo Go has no usable Google Maps key.
    return { nativeTiles: false, provider: 'google', reason: 'expo-go' }
  }

  if (!hasAndroidKey) {
    return { nativeTiles: false, provider: 'google', reason: 'no-key' }
  }

  return { nativeTiles: true, provider: 'google', reason: null }
}

/** Copy for the notice shown when the native map cannot be mounted. */
export function mapsBlockedNotice(availability: MapsAvailability): { title: string; body: string } {
  if (availability.reason === 'expo-go') {
    return {
      title: 'Live map needs a development build',
      body:
        'Google Maps tiles are unavailable in Expo Go — Expo Go stopped shipping a usable Google Maps key in SDK 52, so Google\'s servers reject every tile. The map works in a development build (npx expo run:android). Showing the provider list instead; every provider here is real and verified.',
    }
  }
  return {
    title: 'Google Maps key not configured',
    body:
      'Add GOOGLE_MAPS_ANDROID_KEY to apps/mobile/.env and build a development build (npx expo run:android). See docs/GOOGLE_MAPS.md. Provider locations below are approximate and come from the backend.',
  }
}
