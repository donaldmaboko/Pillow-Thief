import type { ConfigContext, ExpoConfig } from 'expo/config'

/**
 * Google Maps keys are *build-time native inputs*, so they are read from the
 * environment and never committed:
 *
 *   GOOGLE_MAPS_ANDROID_KEY   Maps SDK for Android  (app.pillowthief.mobile)
 *   GOOGLE_MAPS_IOS_KEY       Maps SDK for iOS      (app.pillowthief.mobile)
 *
 * Neither key has ANY effect in Expo Go: Expo Go stopped providing a usable
 * Google Maps key in SDK 52, so on Android the map mounts but every tile
 * request is rejected. Real tiles need a development build:
 *   cd apps/mobile && npx expo run:android
 *
 * See docs/GOOGLE_MAPS.md.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const androidGoogleMapsApiKey = process.env.GOOGLE_MAPS_ANDROID_KEY ?? ''
  const iosGoogleMapsApiKey = process.env.GOOGLE_MAPS_IOS_KEY ?? ''

  const plugins = (config.plugins ?? []).map((plugin) => {
    const isMapsPlugin =
      plugin === 'react-native-maps' ||
      (Array.isArray(plugin) && plugin[0] === 'react-native-maps')
    if (!isMapsPlugin) return plugin

    // THE OPTION NAMES MATTER, and getting them wrong fails silently.
    //
    // react-native-maps' plugin reads `androidGoogleMapsApiKey` and
    // `iosGoogleMapsApiKey` -> AndroidManifest `com.google.android.geo.API_KEY`
    // and Info.plist `GMSApiKey` respectively. The similar-looking
    // `androidGoogleMapsKey` / `iosGoogleMapsKey` are ignored, and because
    // declaring this plugin ALSO suppresses Expo's built-in fallback
    // (@expo/prebuild-config createLegacyPlugin, which would otherwise read
    // `android.config.googleMaps.apiKey`), a misspelling meant no key reached
    // the native build at all — a blank map with no error anywhere.
    // The classic `*.config.googleMaps*` fields are therefore deliberately NOT
    // set: with this plugin declared they are dead config.
    return ['react-native-maps', { androidGoogleMapsApiKey, iosGoogleMapsApiKey }] as typeof plugin
  })

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      // Read at runtime by src/lib/maps.ts to decide whether the native map can
      // be trusted to paint tiles. Booleans, so the key itself is not surfaced
      // in a second place.
      googleMapsAndroidKeyPresent: androidGoogleMapsApiKey.trim().length > 0,
      googleMapsIosKeyPresent: iosGoogleMapsApiKey.trim().length > 0,
    },
    // ConfigContext hands us a Partial<ExpoConfig>, so `name`/`slug` read back
    // as optional even though app.json always supplies them.
  } as ExpoConfig
}
