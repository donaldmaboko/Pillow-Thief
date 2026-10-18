import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Google Maps keys are *build-time native inputs*, so they are read from the
 * environment and never committed to app.json:
 *
 *   GOOGLE_MAPS_ANDROID_KEY   Maps SDK for Android  (app.pillowthief.mobile)
 *   GOOGLE_MAPS_IOS_KEY       Maps SDK for iOS      (app.pillowthief.mobile)
 *
 * They are written to three places, all of which the native SDKs read:
 *   * `android.config.googleMaps.apiKey`  -> AndroidManifest meta-data
 *   * `ios.config.googleMapsApiKey`       -> Info.plist GMSApiKey
 *   * the `react-native-maps` config plugin (the supported path)
 *
 * Neither key has ANY effect in Expo Go. Expo Go stopped providing a usable
 * Google Maps key in SDK 52, so on Android the map mounts but every tile
 * request is rejected ("Authorization failure") and you get a blank grey box.
 * Real tiles need a development build: `npx expo run:android`.
 *
 * See docs/GOOGLE_MAPS.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsKey = process.env.GOOGLE_MAPS_ANDROID_KEY ?? ''
  const iosGoogleMapsKey = process.env.GOOGLE_MAPS_IOS_KEY ?? ''

  const plugins = (config.plugins ?? []).map((plugin) => {
    const isMapsPlugin =
      plugin === 'react-native-maps' ||
      (Array.isArray(plugin) && plugin[0] === 'react-native-maps')
    if (!isMapsPlugin) return plugin
    // Always hand the plugin a full options object — a bare 'react-native-maps'
    // entry (which app.json uses as the placeholder) expects at least one key.
    return ['react-native-maps', { androidGoogleMapsKey, iosGoogleMapsKey }] as typeof plugin
  })

  return {
    ...config,
    ios: {
      ...config.ios,
      config: { ...config.ios?.config, googleMapsApiKey: iosGoogleMapsKey },
    },
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey: androidGoogleMapsKey } },
    },
    plugins,
    extra: {
      ...config.extra,
      // Read at runtime by src/lib/maps.ts to decide whether the native map can
      // be trusted to paint tiles, without shipping the key itself anywhere new.
      googleMapsAndroidKeyPresent: androidGoogleMapsKey.trim().length > 0,
      googleMapsIosKeyPresent: iosGoogleMapsKey.trim().length > 0,
    },
    // ConfigContext hands us a Partial<ExpoConfig>, so `name`/`slug` read back
    // as optional even though app.json always supplies them.
  } as ExpoConfig
}
