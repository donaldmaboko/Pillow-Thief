# Pillow Thief — Google Maps Platform Integration

Google Maps is a core feature: provider discovery, service areas, meeting
locations, travel distances/fees, and "Get Directions" for confirmed bookings.

> **Nothing here is live until you complete this document.** The app detects
> missing keys, shows an explicit notice, and falls back to server-side
> estimates that are labelled as approximations. It never invents a route.

---

## 1. APIs to enable

Google Cloud Console → APIs & Services → Library:

| API | Used for | Where |
| --- | --- | --- |
| **Maps SDK for Android** | Map tiles/gestures on Android | mobile (native) |
| **Maps SDK for iOS** | Map tiles/gestures on iOS | mobile (native) |
| **Places API** | Address/place autocomplete + place details | mobile (autocomplete) + server (validation) |
| **Geocoding API** | Address ↔ coordinates | server |
| **Routes API** | Road distance + travel time | server (`booking-quote`, `booking-create`) |

Billing must be enabled on the project. Set budget alerts; a discovery-heavy
launch can generate meaningful Places traffic.

---

## 2. Credentials and restrictions

Create **separate keys per platform and environment**. Never reuse a key.

### 2.1 Android key (mobile app)

- Application restriction: **Android apps** → package name
  `app.pillowthief.mobile` + SHA-1 of your release signing certificate
  (and the debug certificate for development builds).
- API restriction: **Maps SDK for Android**, plus **Places API** if you enable
  the in-app autocomplete widget.

### 2.2 iOS key (mobile app)

- Application restriction: **iOS apps** → bundle ID `app.pillowthief.mobile`.
- API restriction: **Maps SDK for iOS**, plus **Places API** for autocomplete.

> An iOS key is bound to a bundle ID only. Google cannot verify the signing
> team, so treat this key as public and enforce quota/limits server-side.

### 2.3 Server key (Edge Functions)

- Application restriction: **None** (server IPs are not stable on Supabase).
- API restriction: **Routes API**, **Geocoding API**, **Places API** only.
- Store as the Edge Function secret `GOOGLE_MAPS_SERVER_KEY`.
- **Never** ship this key in the mobile bundle or the admin dashboard.

---

## 3. Wiring the keys into the app

Keys are **build-time native inputs**, so they live in the environment and are
never committed:

```bash
# apps/mobile/.env
GOOGLE_MAPS_ANDROID_KEY=AIza...   # Maps SDK for Android
GOOGLE_MAPS_IOS_KEY=AIza...       # Maps SDK for iOS (optional; iOS falls back to Apple Maps)
```

`apps/mobile/app.config.ts` reads them and passes them to the `react-native-maps`
config plugin — which is the only thing that writes native config. **The option
names must be exact, because a typo fails silently:**

| Option | Writes |
| --- | --- |
| `androidGoogleMapsApiKey` | AndroidManifest `<meta-data android:name="com.google.android.geo.API_KEY" …>` |
| `iosGoogleMapsApiKey` | Info.plist `GMSApiKey`, plus the Google Maps CocoaPod |

`androidGoogleMapsKey` / `iosGoogleMapsKey` (no `Api`) are **not** read. That
misspelling shipped in this repo originally and was worse than useless: because
declaring the plugin at all suppresses Expo's built-in fallback
(`@expo/prebuild-config` → `createLegacyPlugin` → `withGoogleMapsApiKey`, which
would otherwise read `android.config.googleMaps.apiKey`), the result was a build
with no key *anywhere* and not one warning — a blank map that looks like a
network problem. For the same reason the classic `*.config.googleMaps*` fields
are deliberately not set here; with the plugin declared they are dead config.

Verify what the native build actually receives **before** spending minutes on
Gradle:

```bash
cd apps/mobile
env GOOGLE_MAPS_ANDROID_KEY=AIza... npx expo prebuild --platform android --clean
grep geo.API_KEY android/app/src/main/AndroidManifest.xml
```

You want to see:
`<meta-data android:name="com.google.android.geo.API_KEY" android:value="AIza…"/>`

Then rebuild — these are native inputs, so a JS reload is not enough:

```bash
npx expo run:android      # or run:ios
```

### Expo Go cannot show Google Maps

**Google Maps does not work in Expo Go, and no API key will change that.** Expo
Go stopped shipping a usable Google Maps key in SDK 52
([changelog](https://expo.dev/changelog/2024-11-12-sdk-52#deprecations)). On
Android `<MapView>` still mounts, but every tile request is rejected
(`Authorization failure. Please see .../android-sdk/start` in LogCat) and the
user sees a blank grey rectangle with a Google logo. This is an Expo Go
limitation, not a bug in this app.

| Platform | Expo Go | Development build |
| --- | --- | --- |
| Android | ❌ blank tiles, no workaround | ✅ Google Maps with your key |
| iOS | ✅ Apple Maps (MapKit — needs no key) | ✅ Apple Maps, or Google Maps with a key |

`src/lib/maps.ts` encodes exactly this. The Explore Map screen only mounts
`<MapView>` when tiles can really render — on iOS in Expo Go, and on Android in
a development build that has a key. Anywhere else it shows an accurate notice
plus the real provider list, rather than a grey box that looks like a crash.

---

## 4. What the integration does

| Feature | Implementation |
| --- | --- |
| Provider markers | `provider_discovery` view → `lat`/`lng` are the provider's **approximate** neighbourhood point (typically the service-area centre). Exact home coordinates are never exposed. |
| Search this area / city selector / locate me | Region changes re-query the same backend; locating is explicit (button press) and permission denial keeps manual search working |
| Provider preview | Bottom sheet with photo, name, verification, services, starting price, genuine rating, profile link |
| Meeting locations | Three arrangements; house calls are validated against the provider's PostGIS service areas (`service_areas_containing`) |
| Travel fee + distance | `booking-quote` calls Routes API (`computeRoutes`, DRIVING, traffic-aware) server-side and applies the provider's zone fee model |
| Directions | Confirmed bookings expose coordinates to participants only; the "Get Directions" action opens the platform maps app |
| Places autocomplete | Server-side place resolution (`resolvePlaceId`) validates and binds the chosen place_id; client-side widget optional |

### Fee model

```
travel_fee = zone.travel_base_fee_minor + round(distance_km × zone.travel_per_km_minor)
```

Rejected when `distance_km > zone.max_travel_km` (`travel_out_of_range`).
Distances always come from the server — the client never sends a distance or a
price.

---

## 5. Privacy and policy compliance

- **No home addresses.** Providers publish service areas (centre + radius) and
  approved meeting locations. `provider_service_locations` holds public-ish
  places; `booking_locations` (exact meeting point) is RLS-protected to booking
  participants and admins only.
- **No background location.** Only `requestForegroundPermissionsAsync()` when a
  feature needs it. Background tracking is not implemented.
- **Data minimisation.** We store the place_id, a label, and coordinates for the
  booking — not the raw Google response payload. Nothing from Places/Routes is
  cached beyond the booking record it produced.
- **Attribution.** Google Maps attribution is rendered by the native SDK. Do not
  cover it. Review Google's current attribution and caching terms before launch.
- **Estimates are labelled.** Travel time/distance shown to users are marked as
  estimates; arrival times are never guaranteed.

---

## 6. Testing checklist

- [ ] `GOOGLE_MAPS_ANDROID_KEY` / `GOOGLE_MAPS_IOS_KEY` set in `apps/mobile/.env`;
      `npx expo config --type prebuild --json` shows them; dev build installed.
- [ ] Map tiles render on a physical Android device (Google Maps) and iPhone
      (Apple Maps is fine on iOS; enable Maps SDK for iOS only if you need
      Google tiles there).
- [ ] Markers appear only for verified, published providers; suspended ones vanish.
- [ ] Tapping a marker opens the preview sheet with genuine rating data.
- [ ] Denying location permission keeps manual search working.
- [ ] House-call address outside a service area returns
      "This address is outside the provider's service area".
- [ ] `GOOGLE_MAPS_SERVER_KEY` present → booking summary shows a realistic
      distance and the "estimate" disclaimer; remove it → the same screen shows
      the degraded-estimate notice.
- [ ] Routes API quota exceeded → server logs the failure, returns the fallback
      estimate flagged `degraded: true`, and the booking still succeeds with a
      clearly labelled estimate.
- [ ] Confirmed booking shows "Get Directions" only to participants.
- [ ] Google Cloud billing alerts configured.

---

## 7. Cost control

- Prefer `available_slots` (database) over Places calls for availability UI.
- Debounce search input (already 300–500 ms in the UI layer) and never autocomplete
  on every keystroke without a session token.
- Use Autocomplete **session tokens** so a full type-then-select counts as one
  billed session; the server-side `resolvePlaceId` call happens once at
  booking/quote time.
- Set a daily quota cap per API in Cloud Console; the app degrades gracefully
  when a call fails.
